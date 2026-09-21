export const PASSWORD_REQUIREMENTS_TEXT =
  "Must be 8+ characters with at least one special character.";

export function validatePassword(password) {
  const minLength = 8;
  const specialChar = /[!@#$%^&*(),.?":{}|<>]/;

  if (password.length < minLength) {
    return "Password must be at least 8 characters long.";
  }

  if (!specialChar.test(password)) {
    return "Password must include at least one special character.";
  }

  return null;
}
