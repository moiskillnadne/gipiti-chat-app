export type PasswordRequirement = {
  id: string;
  regex: RegExp;
  translationKey: string;
};

export type PasswordStrength = {
  score: number;
  label: "weak" | "medium" | "strong";
  color: string;
};

export const passwordRequirements: PasswordRequirement[] = [
  {
    id: "minLength",
    regex: /.{8,}/,
    translationKey: "auth.validation.minLength",
  },
  {
    id: "uppercase",
    regex: /[A-Z]/,
    translationKey: "auth.validation.uppercase",
  },
  {
    id: "lowercase",
    regex: /[a-z]/,
    translationKey: "auth.validation.lowercase",
  },
  {
    id: "number",
    regex: /[0-9]/,
    translationKey: "auth.validation.number",
  },
  {
    id: "special",
    regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    translationKey: "auth.validation.special",
  },
];

export const checkPasswordRequirement = (
  password: string,
  requirement: PasswordRequirement
): boolean => {
  return requirement.regex.test(password);
};

export const checkAllPasswordRequirements = (
  password: string
): Record<string, boolean> => {
  return passwordRequirements.reduce(
    (acc, req) => {
      acc[req.id] = checkPasswordRequirement(password, req);
      return acc;
    },
    {} as Record<string, boolean>
  );
};

export const calculatePasswordStrength = (
  password: string
): PasswordStrength => {
  if (!password) {
    return { score: 0, label: "weak", color: "rgb(239 68 68)" }; // red-500
  }

  const requirementsMet = passwordRequirements.filter((req) =>
    checkPasswordRequirement(password, req)
  ).length;

  const totalRequirements = passwordRequirements.length;

  // Calculate score as percentage
  const score = (requirementsMet / totalRequirements) * 100;

  // Determine strength label and color
  if (score < 60) {
    return { score, label: "weak", color: "rgb(239 68 68)" }; // red-500
  }
  if (score < 100) {
    return { score, label: "medium", color: "rgb(234 179 8)" }; // yellow-500
  }
  return { score, label: "strong", color: "rgb(34 197 94)" }; // green-500
};

export const isPasswordValid = (password: string): boolean => {
  return passwordRequirements.every((req) =>
    checkPasswordRequirement(password, req)
  );
};

export const getPasswordValidationError = (password: string): string | null => {
  if (!password) {
    return "auth.validation.passwordRequired";
  }

  const unmetRequirements = passwordRequirements.filter(
    (req) => !checkPasswordRequirement(password, req)
  );

  if (unmetRequirements.length > 0) {
    return unmetRequirements[0].translationKey;
  }

  return null;
};
