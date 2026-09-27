package dev.asorichetti.myshelf.textrecognition

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Rect
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class ImageLoadException(uri: String, cause: Throwable?) :
  CodedException("ERR_IMAGE_LOAD", "Could not read the image at $uri", cause)

class RecognitionFailedException(cause: Throwable?) :
  CodedException("ERR_RECOGNITION_FAILED", "Text recognition failed: ${cause?.message}", cause)

/** A photo decoded upright (EXIF applied), possibly scaled down, and the upright size of the original. */
private class Upright(val bitmap: Bitmap, val width: Int, val height: Int)

/**
 * On-device text recognition for photos of book covers (P03-05), with ML Kit
 * Text Recognition v2 and its bundled Latin model: nothing is downloaded and
 * the photo never leaves the phone.
 */
class TextRecognitionModule : Module() {
  private var recognizer: TextRecognizer? = null

  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app context is not available", null)

  private fun client(): TextRecognizer =
    recognizer ?: TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).also { recognizer = it }

  override fun definition() = ModuleDefinition {
    Name("MyShelfTextRecognition")

    /**
     * Reads the text on the image at `uri` (`file://`, `content://` or a
     * path). Frames are in pixels of the upright original image.
     */
    AsyncFunction("recognize") { uri: String, promise: Promise ->
      val image = try {
        decodeUpright(uri, OCR_MAX_SIDE)
      } catch (e: Throwable) {
        promise.reject(ImageLoadException(uri, e))
        return@AsyncFunction
      }
      val scale = image.width.toDouble() / image.bitmap.width
      client()
        .process(InputImage.fromBitmap(image.bitmap, 0))
        .addOnSuccessListener { text ->
          val blocks = text.textBlocks.map { block ->
            mapOf(
              "text" to block.text,
              "frame" to frameOf(block.boundingBox, scale),
              "lines" to block.lines.map { line ->
                mapOf(
                  "text" to line.text,
                  "frame" to frameOf(line.boundingBox, scale),
                  "confidence" to line.confidence.toDouble(),
                  "language" to line.recognizedLanguage,
                  "angle" to line.angle.toDouble()
                )
              }
            )
          }
          image.bitmap.recycle()
          promise.resolve(mapOf("width" to image.width, "height" to image.height, "blocks" to blocks))
        }
        .addOnFailureListener { e ->
          image.bitmap.recycle()
          promise.reject(RecognitionFailedException(e))
        }
    }

    /**
     * An upright copy of the photo at `uri`, cropped to the 2:3 of a book
     * cover and at most `maxHeight` pixels tall, as a JPEG in the cache
     * directory (P03-14: the photo as the book's cover). The crop is the
     * smallest 2:3 rectangle around `focus` ([x, y, width, height] in pixels of
     * the upright original: where the text was read, so the cover itself)
     * with a margin, or the largest one in the middle without it. Returns the
     * JPEG's `file://` URI.
     */
    AsyncFunction("prepareCover") { uri: String, maxHeight: Int, focus: List<Double>? ->
      val image = try {
        decodeUpright(uri, max(maxHeight, 1) * 2)
      } catch (e: Throwable) {
        throw ImageLoadException(uri, e)
      }
      val source = image.bitmap
      val crop = coverCrop(source.width, source.height, focus?.takeIf { it.size == 4 }?.map { it * source.width / image.width })
      val targetHeight = min(crop.height(), max(maxHeight, 1))
      val targetWidth = max(1, (targetHeight * 2.0 / 3.0).roundToInt())
      val cropped = Bitmap.createBitmap(source, crop.left, crop.top, crop.width(), crop.height())
      val scaled = Bitmap.createScaledBitmap(cropped, targetWidth, targetHeight, true)
      val dir = File(appContext.cacheDirectory, "cover-photos").apply { mkdirs() }
      val file = File(dir, "${UUID.randomUUID()}.jpg")
      FileOutputStream(file).use { out -> scaled.compress(Bitmap.CompressFormat.JPEG, 90, out) }
      if (scaled !== cropped) scaled.recycle()
      if (cropped !== source) cropped.recycle()
      source.recycle()
      Uri.fromFile(file).toString()
    }

    OnDestroy {
      recognizer?.close()
      recognizer = null
    }
  }

  private fun open(uri: String): InputStream {
    val parsed = Uri.parse(uri)
    return if (parsed.scheme.isNullOrEmpty()) File(uri).inputStream()
    else context.contentResolver.openInputStream(parsed) ?: throw IllegalArgumentException("No content at $uri")
  }

  /** Decodes the image halved until its longer side is at most `maxSide`, and turns it upright by its EXIF orientation. */
  private fun decodeUpright(uri: String, maxSide: Int): Upright {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    open(uri).use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw IllegalArgumentException("Not an image")
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > maxSide) sample *= 2
    val decoded = open(uri).use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
      ?: throw IllegalArgumentException("Could not decode the image")
    val orientation = try {
      open(uri).use { ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL) }
    } catch (e: Throwable) {
      ExifInterface.ORIENTATION_NORMAL
    }
    val matrix = Matrix()
    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 -> matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.setScale(1f, -1f)
      ExifInterface.ORIENTATION_TRANSPOSE -> { matrix.setRotate(90f); matrix.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_ROTATE_90 -> matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> { matrix.setRotate(-90f); matrix.postScale(-1f, 1f) }
      ExifInterface.ORIENTATION_ROTATE_270 -> matrix.setRotate(-90f)
    }
    val upright = if (matrix.isIdentity) decoded
    else Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, matrix, true).also { if (it !== decoded) decoded.recycle() }
    val quarterTurn = orientation in setOf(
      ExifInterface.ORIENTATION_ROTATE_90,
      ExifInterface.ORIENTATION_ROTATE_270,
      ExifInterface.ORIENTATION_TRANSPOSE,
      ExifInterface.ORIENTATION_TRANSVERSE
    )
    return Upright(
      upright,
      if (quarterTurn) bounds.outHeight else bounds.outWidth,
      if (quarterTurn) bounds.outWidth else bounds.outHeight
    )
  }

  /** A 2:3 rectangle inside a `width` × `height` image: around `focus` (x, y, w, h) with a margin, or the largest centred one. */
  private fun coverCrop(width: Int, height: Int, focus: List<Double>?): Rect {
    val largestWidth = min(width.toDouble(), height * 2.0 / 3.0)
    var cropWidth = largestWidth
    var centreX = width / 2.0
    var centreY = height / 2.0
    if (focus != null && focus[2] > 0 && focus[3] > 0) {
      val (fx, fy, fw, fh) = focus
      // A margin around the text: covers have art and edges beyond their words.
      val w = fw * (1 + 2 * FOCUS_MARGIN)
      val h = fh * (1 + 2 * FOCUS_MARGIN)
      cropWidth = min(largestWidth, max(w, h * 2.0 / 3.0))
      centreX = fx + fw / 2
      centreY = fy + fh / 2
    }
    val cropHeight = min(height.toDouble(), cropWidth * 3.0 / 2.0)
    cropWidth = cropHeight * 2.0 / 3.0
    val left = (centreX - cropWidth / 2).coerceIn(0.0, width - cropWidth).roundToInt()
    val top = (centreY - cropHeight / 2).coerceIn(0.0, height - cropHeight).roundToInt()
    val right = min(width, left + cropWidth.roundToInt())
    val bottom = min(height, top + cropHeight.roundToInt())
    return Rect(left, top, right, bottom)
  }

  private fun frameOf(box: Rect?, scale: Double): Map<String, Int>? = box?.let {
    mapOf(
      "x" to (it.left * scale).roundToInt(),
      "y" to (it.top * scale).roundToInt(),
      "width" to (it.width() * scale).roundToInt(),
      "height" to (it.height() * scale).roundToInt()
    )
  }

  companion object {
    /** ML Kit needs characters of at least about 16 px; covers have large type, so 2048 px is plenty and keeps memory low. */
    private const val OCR_MAX_SIDE = 2048

    /** The margin kept around the text when cropping a cover photo, as a share of the text's size on each side. */
    private const val FOCUS_MARGIN = 0.12
  }
}
