typedef Json = Map<String, Object?>;

Json object(Object? value) {
  if (value is Map) return value.cast<String, Object?>();
  throw const FormatException('Expected JSON object');
}

List<Object?> array(Object? value) =>
    value is List ? value.cast<Object?>() : const [];
String string(Object? value, [String fallback = '']) =>
    value is String ? value : fallback;
int integer(Object? value, [int fallback = 0]) =>
    value is num ? value.toInt() : fallback;
DateTime? instant(Object? value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;

class PageData<T> {
  const PageData(this.items, this.page, this.totalPages, this.totalElements);
  factory PageData.fromJson(Object? data, T Function(Json) decode) {
    final json = object(data);
    return PageData(
      array(json['items']).map((e) => decode(object(e))).toList(),
      integer(json['page']),
      integer(json['totalPages']),
      integer(json['totalElements']),
    );
  }
  final List<T> items;
  final int page, totalPages, totalElements;
  bool get hasNext => page + 1 < totalPages;
}
