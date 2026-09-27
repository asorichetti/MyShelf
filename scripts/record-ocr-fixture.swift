// Records the text on a photo of a book cover as an OCR fixture for
// src/domain/ocrQuery.ts (P03-06), using Apple's Vision framework as a stand-in
// for ML Kit, which cannot run on a Mac. macOS only; run it by hand, never in CI:
//
//   swift scripts/record-ocr-fixture.swift <photo> [maxDimension] > capture.json
//
// Output: { imageSize, result: { blocks: [{ text, frame, lines: [{ text, frame, confidence }] }] } }
// with pixel frames (top-left origin) on the photo scaled so its longer side is
// maxDimension (default 1620, roughly a phone camera preview), which is the
// app's OcrResult shape. Vision reports one observation per line, so each line
// becomes a one-line block. To commit a capture, wrap it as the fixtures in
// src/domain/__fixtures__/ocr/ are: add "synthetic": false, a "note" saying it
// was recorded with Apple Vision from a developer photo, a "description" and the
// "expected" title and author. Never commit the photo itself (the cover art is
// copyrighted). ML Kit captures from an Android device or emulator are recorded
// with scripts/record-mlkit-fixture.mjs instead.
import AppKit
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 2 else {
  FileHandle.standardError.write("usage: swift scripts/record-ocr-fixture.swift <image> [maxDimension]\n".data(using: .utf8)!)
  exit(2)
}
let url = URL(fileURLWithPath: args[1])
let maxDimension = args.count >= 3 ? Double(args[2]) ?? 1620 : 1620

guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
      let original = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
  FileHandle.standardError.write("cannot read \(url.path)\n".data(using: .utf8)!)
  exit(1)
}

// Downscale to a phone-camera-preview-like size so frames look like ML Kit's.
let scale = min(1.0, maxDimension / Double(max(original.width, original.height)))
let width = Int(Double(original.width) * scale), height = Int(Double(original.height) * scale)
let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.interpolationQuality = .high
context.draw(original, in: CGRect(x: 0, y: 0, width: width, height: height))
let image = context.makeImage()!

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])

func frame(_ box: CGRect) -> [String: Int] {
  ["x": Int((box.minX * Double(width)).rounded()),
   "y": Int(((1 - box.maxY) * Double(height)).rounded()),
   "width": Int((box.width * Double(width)).rounded()),
   "height": Int((box.height * Double(height)).rounded())]
}

// Vision reports one observation per line; each becomes a one-line block.
let blocks: [[String: Any]] = (request.results ?? []).compactMap { obs in
  guard let best = obs.topCandidates(1).first else { return nil }
  let f = frame(obs.boundingBox)
  let confidence = (Double(best.confidence) * 100).rounded() / 100
  return ["text": best.string, "frame": f, "lines": [["text": best.string, "frame": f, "confidence": confidence]]]
}
let output: [String: Any] = ["imageSize": ["width": width, "height": height], "result": ["blocks": blocks]]
let data = try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted, .sortedKeys])
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
