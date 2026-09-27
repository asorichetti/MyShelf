// Converts a developer's photo of a book cover to a JPEG with no metadata
// (no capture date, no location), for the Maestro cover-scan flows
// (.maestro/cover-scan/photo-*.yaml) and scripts/record-mlkit-fixture.mjs. Without
// a capture date the phone's photo picker lists the photo first, as the newest,
// which is where the flows tap. macOS only; run it by hand:
//
//   swift scripts/prepare-test-photo.swift <photo.png|jpg|heic> .maestro/cover-scan/photos/<book>.jpg
//
// .maestro/cover-scan/photos/ is git-ignored: never commit the photos (the cover art is not ours).
import Foundation
import ImageIO

let args = CommandLine.arguments
guard args.count == 3 else {
  FileHandle.standardError.write("usage: swift scripts/prepare-test-photo.swift <in> <out.jpg>\n".data(using: .utf8)!)
  exit(2)
}
guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[1]) as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let out = CGImageDestinationCreateWithURL(URL(fileURLWithPath: args[2]) as CFURL, "public.jpeg" as CFString, 1, nil) else {
  FileHandle.standardError.write("cannot read \(args[1]) or write \(args[2])\n".data(using: .utf8)!)
  exit(1)
}
// The pixels only, upright as stored: the photos are already upright, and no EXIF block is written.
CGImageDestinationAddImage(out, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
guard CGImageDestinationFinalize(out) else { exit(1) }
