import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'json.dart';
import 'l10n.dart';
import 'theme.dart';

String dateLabel(BuildContext context, DateTime value, {bool time = false}) =>
    (time
            ? DateFormat.yMMMd(
                Localizations.localeOf(context).languageCode,
              ).add_Hm()
            : DateFormat.yMMMd(Localizations.localeOf(context).languageCode))
        .format(value);
String clockLabel(DateTime value) => DateFormat.Hm().format(value);
String localDay(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

class DataView<T> extends StatefulWidget {
  const DataView({super.key, required this.load, required this.builder});
  final Future<T> Function() load;
  final Widget Function(T data, Future<void> Function() reload) builder;
  @override
  State<DataView<T>> createState() => _DataViewState<T>();
}

class _DataViewState<T> extends State<DataView<T>> {
  late Future<T> _future = widget.load();
  Future<void> reload() async {
    final next = widget.load();
    setState(() => _future = next);
    try {
      await next;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Padding(
          padding: EdgeInsets.all(40),
          child: Center(child: CircularProgressIndicator()),
        );
      }
      if (snapshot.hasError) {
        return ErrorPanel(error: snapshot.error!, retry: reload);
      }
      return widget.builder(snapshot.data as T, reload);
    },
  );
}

class ErrorPanel extends StatelessWidget {
  const ErrorPanel({super.key, required this.error, required this.retry});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.cloud_off_outlined, size: 40),
        const SizedBox(height: 12),
        Text(context.errorText(error), textAlign: TextAlign.center),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: retry,
          icon: const Icon(Icons.refresh),
          label: Text(context.t('retry')),
        ),
      ],
    ),
  );
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.title, required this.child, this.icon});
  final String title;
  final Widget child;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, color: brand),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    ),
  );
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final warning = [
      'MISSED',
      'CANCELLED',
      'REJECTED',
      'CUSTOMER_NO_SHOW',
      'DECLINED',
      'NEEDS_ATTENTION',
    ].contains(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: warning ? const Color(0xFFFFEDE5) : const Color(0xFFEAF2E9),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        context.t(status),
        style: TextStyle(
          color: warning ? const Color(0xFF92400E) : brand,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, this.text = 'empty'});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 12),
    child: Center(
      child: Column(
        children: [
          const Icon(Icons.spa_outlined, size: 42, color: brand),
          const SizedBox(height: 12),
          Text(context.t(text), textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}

class ActionButton extends StatefulWidget {
  const ActionButton({
    super.key,
    required this.label,
    required this.action,
    this.icon,
    this.enabled = true,
    this.outlined = false,
  });
  final String label;
  final Future<void> Function() action;
  final IconData? icon;
  final bool enabled, outlined;
  @override
  State<ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<ActionButton> {
  bool busy = false;
  Future<void> run() async {
    setState(() => busy = true);
    try {
      await widget.action();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (busy) ...[
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: 10),
        ] else if (widget.icon != null) ...[
          Icon(widget.icon),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(context.t(widget.label), textAlign: TextAlign.center),
        ),
      ],
    );
    return widget.outlined
        ? OutlinedButton(
            onPressed: busy || !widget.enabled ? null : run,
            child: child,
          )
        : FilledButton(
            onPressed: busy || !widget.enabled ? null : run,
            child: child,
          );
  }
}

void showError(BuildContext context, Object e) => ScaffoldMessenger.of(
  context,
).showSnackBar(SnackBar(content: Text(context.errorText(e))));
void showMessage(BuildContext context, String key) => ScaffoldMessenger.of(
  context,
).showSnackBar(SnackBar(content: Text(context.t(key))));
Future<bool> confirm(BuildContext context, String key) async =>
    await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(ctx.t(key)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.t('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.t('confirm')),
          ),
        ],
      ),
    ) ??
    false;

Future<String?> askText(
  BuildContext context,
  String title, {
  int minLength = 1,
  int maxLength = 500,
  bool optional = false,
}) async {
  final controller = TextEditingController();
  final form = GlobalKey<FormState>();
  final value = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(ctx.t(title)),
      content: Form(
        key: form,
        child: TextFormField(
          controller: controller,
          maxLength: maxLength,
          minLines: 2,
          maxLines: 5,
          autofocus: true,
          decoration: InputDecoration(labelText: ctx.t(title)),
          validator: (v) => !optional && (v?.trim().length ?? 0) < minLength
              ? ctx.t(minLength == 10 ? 'reasonShort' : 'required')
              : null,
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text(ctx.t('cancel')),
        ),
        FilledButton(
          onPressed: () {
            if (form.currentState!.validate()) {
              Navigator.pop(ctx, controller.text.trim());
            }
          },
          child: Text(ctx.t('confirm')),
        ),
      ],
    ),
  );
  // Dialog route disposes after its closing animation.
  Future<void>.delayed(const Duration(seconds: 1), controller.dispose);
  return value;
}

class Field extends StatelessWidget {
  const Field(
    this.label,
    this.controller, {
    super.key,
    this.required = false,
    this.maxLength,
    this.lines = 1,
    this.enabled = true,
    this.keyboard,
    this.validator,
    this.onChanged,
    this.obscure = false,
  });
  final String label;
  final TextEditingController controller;
  final bool required, enabled, obscure;
  final int? maxLength;
  final int lines;
  final TextInputType? keyboard;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onChanged;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: controller,
      enabled: enabled,
      obscureText: obscure,
      maxLength: maxLength,
      minLines: lines,
      maxLines: lines,
      keyboardType: keyboard,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: context.t(label),
        alignLabelWithHint: lines > 1,
      ),
      validator:
          validator ??
          (v) => required && (v?.trim().isEmpty ?? true)
              ? context.t('required')
              : null,
    ),
  );
}

class Pager<T> extends StatelessWidget {
  const Pager(this.data, this.change, {super.key});
  final PageData<T> data;
  final ValueChanged<int> change;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          tooltip: context.t('previous'),
          onPressed: data.page > 0 ? () => change(data.page - 1) : null,
          icon: const Icon(Icons.chevron_left),
        ),
        Flexible(
          child: Text(
            '${context.t('page')} ${data.page + 1} / ${data.totalPages == 0 ? 1 : data.totalPages}',
            textAlign: TextAlign.center,
          ),
        ),
        IconButton(
          tooltip: context.t('next'),
          onPressed: data.hasNext ? () => change(data.page + 1) : null,
          icon: const Icon(Icons.chevron_right),
        ),
      ],
    ),
  );
}

class UnsavedGuard extends StatefulWidget {
  const UnsavedGuard({super.key, required this.dirty, required this.child});
  final bool dirty;
  final Widget child;
  @override
  State<UnsavedGuard> createState() => _UnsavedGuardState();
}

class _UnsavedGuardState extends State<UnsavedGuard> {
  bool leaving = false;
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !widget.dirty || leaving,
    onPopInvokedWithResult: (didPop, result) async {
      if (didPop || leaving) return;
      if (await confirm(context, 'unsaved') && mounted) {
        setState(() => leaving = true);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.of(context).pop(result);
        });
      }
    },
    child: widget.child,
  );
}
