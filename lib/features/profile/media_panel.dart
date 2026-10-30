import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth.dart';
import '../../core/device.dart';
import '../../core/json.dart';
import '../../core/uploads.dart';
import '../../core/widgets.dart';

class MediaPanel extends ConsumerStatefulWidget {
  const MediaPanel({super.key, required this.ownerType, required this.ownerId});
  final String ownerType, ownerId;
  @override
  ConsumerState<MediaPanel> createState() => _MediaPanelState();
}

class _MediaPanelState extends ConsumerState<MediaPanel> {
  bool busy = false;
  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiProvider),
        path = '/provider-media/${widget.ownerType}/${widget.ownerId}';
    return DataView<List<MediaFile>>(
      load: () async => array(
        await api.get(path),
      ).map((v) => MediaFile.fromJson(object(v))).toList(),
      builder: (files, reload) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final f in files)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (f.type.startsWith('image/') &&
                      Uri.tryParse(f.url)?.scheme == 'https')
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        f.url,
                        height: 160,
                        fit: BoxFit.contain,
                        errorBuilder: (c, e, s) =>
                            const Icon(Icons.broken_image_outlined, size: 48),
                      ),
                    ),
                  TextButton(
                    onPressed: () async {
                      try {
                        await openDownload(f.url);
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: Text(f.name),
                  ),
                  ActionButton(
                    label: 'remove',
                    enabled: !busy,
                    outlined: true,
                    action: () async {
                      if (!await confirm(context, 'deleteConfirm')) return;
                      setState(() => busy = true);
                      try {
                        await api.request('DELETE', '$path/${f.id}');
                        await reload();
                      } finally {
                        if (mounted) setState(() => busy = false);
                      }
                    },
                  ),
                ],
              ),
            ),
          ActionButton(
            label: 'upload',
            outlined: true,
            enabled: !busy,
            icon: Icons.upload_outlined,
            action: () async {
              setState(() => busy = true);
              try {
                final file = await pickUpload(
                  certificate: widget.ownerType == 'CERTIFICATE',
                  avatar: widget.ownerType == 'CAREGIVER_PROFILE',
                );
                if (file == null) return;
                await api.post(path, data: await file.form());
                await reload();
              } finally {
                if (mounted) setState(() => busy = false);
              }
            },
          ),
        ],
      ),
    );
  }
}
