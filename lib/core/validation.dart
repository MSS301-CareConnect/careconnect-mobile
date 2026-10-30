import 'dart:convert';

bool strongPassword(String value) =>
    value.length >= 8 &&
    utf8.encode(value).length <= 72 &&
    RegExp('[a-z]').hasMatch(value) &&
    RegExp('[A-Z]').hasMatch(value) &&
    RegExp('[0-9]').hasMatch(value) &&
    RegExp(r'[^a-zA-Z0-9]').hasMatch(value) &&
    !value.contains('\n');
