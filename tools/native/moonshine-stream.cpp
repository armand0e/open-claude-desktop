// Open-Claude Moonshine streaming sidecar. Audio arrives on stdin as raw
// little-endian signed PCM16 mono at 16 kHz. Transcript snapshots are emitted
// as newline-delimited JSON on stdout.

#include <algorithm>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

#include "moonshine-cpp.h"

namespace {
std::string jsonEscape(const std::string& value) {
  std::ostringstream output;
  for (const unsigned char character : value) {
    switch (character) {
      case '"': output << "\\\""; break;
      case '\\': output << "\\\\"; break;
      case '\b': output << "\\b"; break;
      case '\f': output << "\\f"; break;
      case '\n': output << "\\n"; break;
      case '\r': output << "\\r"; break;
      case '\t': output << "\\t"; break;
      default:
        if (character < 0x20) {
          const char* digits = "0123456789abcdef";
          output << "\\u00" << digits[character >> 4] << digits[character & 15];
        } else {
          output << character;
        }
    }
  }
  return output.str();
}

class Listener final : public moonshine::TranscriptEventListener {
 public:
  void onLineStarted(const moonshine::LineStarted& event) override {
    updateCurrent(event.line.text);
  }

  void onLineTextChanged(const moonshine::LineTextChanged& event) override {
    updateCurrent(event.line.text);
  }

  void onLineCompleted(const moonshine::LineCompleted& event) override {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!event.line.text.empty() &&
        (completed_.empty() || completed_.back() != event.line.text)) {
      completed_.push_back(event.line.text);
    }
    current_.clear();
    emitLocked(false);
  }

  void onError(const moonshine::Error& event) override {
    std::lock_guard<std::mutex> lock(mutex_);
    std::cout << "{\"error\":\"" << jsonEscape(event.errorMessage)
              << "\"}" << std::endl;
  }

  void emitFinal() {
    std::lock_guard<std::mutex> lock(mutex_);
    emitLocked(true);
  }

 private:
  void updateCurrent(const std::string& text) {
    std::lock_guard<std::mutex> lock(mutex_);
    current_ = text;
    emitLocked(false);
  }

  std::string textLocked() const {
    std::ostringstream text;
    bool needsSpace = false;
    for (const auto& line : completed_) {
      if (needsSpace) text << ' ';
      text << line;
      needsSpace = true;
    }
    if (!current_.empty()) {
      if (needsSpace) text << ' ';
      text << current_;
    }
    return text.str();
  }

  void emitLocked(bool final) const {
    std::cout << "{\"text\":\"" << jsonEscape(textLocked())
              << "\",\"final\":" << (final ? "true" : "false") << "}"
              << std::endl;
  }

  mutable std::mutex mutex_;
  std::vector<std::string> completed_;
  std::string current_;
};
}  // namespace

int main(int argc, char* argv[]) {
  if (argc < 2) {
    std::cerr << "Usage: moonshine-stream MODEL_PATH [MODEL_ARCH]" << std::endl;
    return 2;
  }
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY);
#endif
  const auto architecture = static_cast<moonshine::ModelArch>(
      argc >= 3 ? std::stoi(argv[2]) : 5);
  try {
    moonshine::Transcriber transcriber(argv[1], architecture, 0.2f);
    Listener listener;
    transcriber.addListener(&listener);
    transcriber.start();
    std::vector<char> bytes(8192);
    while (std::cin.good()) {
      std::cin.read(bytes.data(), static_cast<std::streamsize>(bytes.size()));
      const auto count = std::cin.gcount();
      if (count <= 0) break;
      std::vector<float> audio;
      audio.reserve(static_cast<size_t>(count / 2));
      for (std::streamsize index = 0; index + 1 < count; index += 2) {
        const auto low = static_cast<uint8_t>(bytes[index]);
        const auto high = static_cast<uint8_t>(bytes[index + 1]);
        const auto sample = static_cast<int16_t>(low | (high << 8));
        audio.push_back(static_cast<float>(sample) / 32768.0f);
      }
      if (audio.empty()) continue;
      // Stream::addAudio applies the transcriber's 200 ms update interval and
      // dispatches listener events; an extra manual update here would run the
      // decoder twice for the same PCM window.
      transcriber.addAudio(audio, 16000);
    }
    transcriber.stop();
    listener.emitFinal();
    return 0;
  } catch (const std::exception& error) {
    std::cout << "{\"error\":\"" << jsonEscape(error.what()) << "\"}"
              << std::endl;
    return 1;
  }
}
