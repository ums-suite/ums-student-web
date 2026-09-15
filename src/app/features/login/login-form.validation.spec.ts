import { isLoginFormValid, validateLoginForm } from './login-form.validation';

describe('validateLoginForm', () => {
  it('requires an identifier', () => {
    const errors = validateLoginForm({ identifier: '', password: 'secret' });
    expect(errors.identifier).toBe('validation.identifier.required');
  });

  it('treats a whitespace-only identifier as missing', () => {
    const errors = validateLoginForm({ identifier: '   ', password: 'secret' });
    expect(errors.identifier).toBe('validation.identifier.required');
  });

  it('requires a password', () => {
    const errors = validateLoginForm({ identifier: 'jdoe', password: '' });
    expect(errors.password).toBe('validation.password.required');
  });

  it('is valid with both fields present', () => {
    const errors = validateLoginForm({ identifier: 'jdoe', password: 'secret' });
    expect(isLoginFormValid(errors)).toBeTrue();
  });

  it('is invalid when any field is missing', () => {
    const errors = validateLoginForm({ identifier: '', password: '' });
    expect(isLoginFormValid(errors)).toBeFalse();
  });
});
