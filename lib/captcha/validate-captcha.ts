type CaptchaValidationResult = {
  isValid: boolean;
  message?: string;
};

type YandexCaptchaResponse = {
  status: "ok" | "failed";
  message?: string;
};

const YANDEX_VALIDATE_URL = "https://smartcaptcha.cloud.yandex.ru/validate";

export const validateCaptcha = async (
  token: string,
  ip?: string
): Promise<CaptchaValidationResult> => {
  const secretKey = process.env.YANDEX_SMARTCAPTCHA_SECRET_KEY;

  if (!secretKey) {
    // Skip validation in dev/test when env vars are not set
    return { isValid: true };
  }

  if (!token) {
    return { isValid: false, message: "Captcha token is missing" };
  }

  try {
    const params = new URLSearchParams({
      secret: secretKey,
      token,
    });

    if (ip) {
      params.set("ip", ip);
    }

    const response = await fetch(YANDEX_VALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    // Per Yandex docs: treat HTTP errors as successful validation
    // to avoid blocking users due to Yandex service issues
    if (!response.ok) {
      console.error(
        `[Captcha] Yandex API returned status ${response.status}, allowing request`
      );
      return { isValid: true };
    }

    const data = (await response.json()) as YandexCaptchaResponse;

    if (data.status === "ok") {
      return { isValid: true };
    }

    return {
      isValid: false,
      message: data.message ?? "Captcha validation failed",
    };
  } catch (error) {
    // Network/service errors — allow the request through
    console.error(
      "[Captcha] Validation request failed, allowing request:",
      error
    );
    return { isValid: true };
  }
};
