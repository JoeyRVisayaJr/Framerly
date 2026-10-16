# Framerly

A web application that automates batch framing of event photography, applying a single branded frame to hundreds of pictures with automatic centering and manual adjustments.

## Language

**Frame**:
A branded graphical template or border containing an aperture (cutout area) through which an event picture is displayed.
_Avoid_: Border, template, overlay, canvas

**Picture**:
An individual photograph captured during an event to be framed.
_Avoid_: Photo, image, asset, snap

**Batch**:
A collection of pictures uploaded together from an event to receive the same frame.
_Avoid_: Folder, album, gallery

**Framed Picture**:
The final composited visual asset resulting from placing and fitting a picture within a frame.
_Avoid_: Output, post, export

**Aperture**:
The transparent or designated region within a frame where the picture is positioned and visible.
_Avoid_: Hole, window, cutout, mask

**Aperture Calibration**:
Defining or fine-tuning the bounding coordinates of the aperture on a frame.
_Avoid_: Crop area, boundary box, mask area

**Auto-Centering**:
The automatic positioning and focal adjustment of a picture within the frame's aperture based on subject detection or optical center fallback.
_Avoid_: Smart crop, auto fit, face centering

**Subject Detection**:
Client-side detection of human faces or focal points in a picture to calculate optimal framing position.
_Avoid_: Face tracking, AI crop, smart centering

**Crop Mode**:
The strategy used to fit a picture into the aperture when aspect ratios differ (`Crop to Fill` or `Fit with Blurred Background`).
_Avoid_: Scale mode, aspect mode, fill type

**Adjustment Modal**:
The interactive overlay interface for manual pan, zoom, 90° rotation, and resetting of an individual picture.
_Avoid_: Edit popup, cropper dialog, adjustment tool

**Visual Grid**:
The gallery interface displaying rendered thumbnail previews of all framed pictures in a batch for rapid scanning and selective adjustment.
_Avoid_: Photo list, gallery, feed

**Batch Export**:
The process of rendering all framed pictures with their exact filenames and packaging them into a downloadable ZIP archive with a live progress bar.
_Avoid_: Bulk download, zip generation, batch render
