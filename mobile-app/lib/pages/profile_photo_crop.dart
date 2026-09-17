import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

class ProfilePhotoCrop extends StatefulWidget {
  final File file;
  const ProfilePhotoCrop({super.key, required this.file});

  @override
  State<ProfilePhotoCrop> createState() => _ProfilePhotoCropState();
}

class _ProfilePhotoCropState extends State<ProfilePhotoCrop> {
  ui.Image? _image;
  String? _error;
  double _zoom = 1, _startZoom = 1, _size = 1;
  Offset _offset = Offset.zero, _startOffset = Offset.zero, _focal = Offset.zero;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final codec = await ui.instantiateImageCodec(await widget.file.readAsBytes());
      final frame = await codec.getNextFrame();
      codec.dispose();
      if (!mounted) { frame.image.dispose(); return; }
      setState(() => _image = frame.image);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not open this image. Please choose another photo.');
    }
  }

  Rect _source() {
    final image = _image!;
    final side = math.min(image.width, image.height) / _zoom;
    final maxX = (image.width - side) / 2;
    final maxY = (image.height - side) / 2;
    _offset = Offset(_offset.dx.clamp(-maxX, maxX), _offset.dy.clamp(-maxY, maxY));
    return Rect.fromLTWH(maxX - _offset.dx, maxY - _offset.dy, side, side);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final recorder = ui.PictureRecorder();
      Canvas(recorder).drawImageRect(_image!, _source(), const Rect.fromLTWH(0, 0, 512, 512), Paint());
      final picture = recorder.endRecording();
      final output = await picture.toImage(512, 512);
      picture.dispose();
      final bytes = await output.toByteData(format: ui.ImageByteFormat.png);
      output.dispose();
      final file = File('${Directory.systemTemp.path}/alaga_profile_${DateTime.now().microsecondsSinceEpoch}.png');
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      if (mounted) Navigator.pop(context, file);
    } catch (_) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not crop photo. Please try again.')));
      }
    }
  }

  @override
  void dispose() { _image?.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Adjust profile photo')),
    body: _error != null ? Center(child: Text(_error!)) : _image == null
        ? const Center(child: CircularProgressIndicator())
        : Padding(
            padding: const EdgeInsets.all(24),
            child: Column(children: [
              const Text('Drag to reposition. Pinch or use the slider to zoom.'),
              const SizedBox(height: 20),
              Expanded(child: Center(child: AspectRatio(aspectRatio: 1, child: LayoutBuilder(
                builder: (_, constraints) {
                  _size = constraints.maxWidth;
                  final source = _source();
                  return GestureDetector(
                    onScaleStart: (d) { _startZoom = _zoom; _startOffset = _offset; _focal = d.localFocalPoint; },
                    onScaleUpdate: _saving ? null : (d) => setState(() {
                      _zoom = (_startZoom * d.scale).clamp(1, 4);
                      _offset = _startOffset + (d.localFocalPoint - _focal) * (math.min(_image!.width, _image!.height) / _zoom / _size);
                    }),
                    child: ClipOval(child: CustomPaint(size: Size.square(_size), painter: _CropPainter(_image!, source))),
                  );
                },
              )))),
              Slider(value: _zoom, min: 1, max: 4, label: '${_zoom.toStringAsFixed(1)}×',
                onChanged: _saving ? null : (value) => setState(() => _zoom = value)),
              SafeArea(child: FilledButton(onPressed: _saving ? null : _save,
                child: Text(_saving ? 'Preparing…' : 'Use photo'))),
            ]),
          ),
  );
}

class _CropPainter extends CustomPainter {
  final ui.Image image;
  final Rect source;
  _CropPainter(this.image, this.source);
  @override
  void paint(Canvas canvas, Size size) => canvas.drawImageRect(image, source, Offset.zero & size, Paint()..filterQuality = FilterQuality.high);
  @override
  bool shouldRepaint(_CropPainter old) => old.source != source || old.image != image;
}
