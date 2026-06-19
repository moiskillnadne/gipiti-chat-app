import { creditBalance, ensureBalance } from "../../../billing/balance";
import {
  DEFAULT_CURRENCY_CODE,
  WELCOME_GRANT_MAJOR_UNITS,
} from "../../../billing/constants";
import { majorToMinorUnits } from "../../../billing/money";
import { ChatSDKError } from "../../../errors";
import type { RegistrationGeo } from "../../../geo/registration-geo";
import type { UtmData } from "../../../utm/constants";
import { db } from "../../connection";
import { user } from "../../schema";
import { generateHashedPassword } from "../../utils";

export async function createUser(
  email: string,
  password: string,
  utmData?: UtmData,
  registrationGeo?: RegistrationGeo
) {
  const hashedPassword = generateHashedPassword(password);

  let newUser: typeof user.$inferSelect;

  try {
    const [created] = await db
      .insert(user)
      .values({
        email,
        password: hashedPassword,
        ...(utmData && {
          utmSource: utmData.utmSource,
          utmMedium: utmData.utmMedium,
          utmCampaign: utmData.utmCampaign,
          utmContent: utmData.utmContent,
          utmTerm: utmData.utmTerm,
        }),
        ...(registrationGeo && {
          registrationCountry: registrationGeo.country,
          registrationRegion: registrationGeo.region,
          registrationCity: registrationGeo.city,
          registrationLanguage: registrationGeo.language,
        }),
      })
      .returning();

    newUser = created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }

  // Seed the currency-based balance: ensure a zeroed RUB row, then credit the
  // one-time welcome grant to the persistent top-up pool so it never resets.
  await ensureBalance(newUser.id, DEFAULT_CURRENCY_CODE);
  await creditBalance({
    userId: newUser.id,
    pool: "topup",
    amount: majorToMinorUnits(WELCOME_GRANT_MAJOR_UNITS, 2),
    type: "welcome",
    description: "Welcome grant",
  });

  return newUser;
}
