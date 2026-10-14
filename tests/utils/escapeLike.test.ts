import { escapeLike } from '../../src/utils/escapeLike';

describe('escapeLike', () => {
  it('makes % _ and \\ literal for .ilike()', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });
  it('leaves ordinary names alone', () => {
    expect(escapeLike('Food & Dining')).toBe('Food & Dining');
  });
  it('turns a bare wildcard into a literal so it cannot match every category', () => {
    expect(escapeLike('%')).toBe('\\%');
  });
});
