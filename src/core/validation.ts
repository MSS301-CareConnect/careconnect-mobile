export function utf8Length(value: string): number {
  let length = 0;
  for (const point of value) {
    const code = point.codePointAt(0) ?? 0;
    length += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return length;
}

export function isStrongPassword(value: string): boolean {
  return (
    utf8Length(value) <= 72 &&
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/u.test(value)
  );
}
