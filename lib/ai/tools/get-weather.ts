import { tool } from "ai";
import { z } from "zod";

async function geocodeCity(
  city: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch {
    return null;
  }
}

export const getWeather = tool({
  description:
    "Get the current weather at a location. Provide a city name or both latitude and longitude.",
  inputSchema: z
    .object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      city: z
        .string()
        .describe("City name (e.g., 'San Francisco', 'New York', 'London')")
        .optional(),
    })
    .refine(
      (input) => {
        const hasCoordinates =
          typeof input.latitude === "number" &&
          typeof input.longitude === "number";
        const hasCity = typeof input.city === "string" && input.city.length > 0;

        if (hasCoordinates && hasCity) {
          return false;
        }

        if (hasCity) {
          return true;
        }

        return (
          hasCoordinates &&
          Number.isFinite(input.latitude) &&
          Number.isFinite(input.longitude)
        );
      },
      {
        message:
          "Provide either a city name or both latitude and longitude coordinates.",
      }
    ),
  execute: async (input) => {
    const hasCity = typeof input.city === "string" && input.city.length > 0;

    let latitude: number;
    let longitude: number;

    if (hasCity && input.city) {
      const coords = await geocodeCity(input.city);
      if (!coords) {
        return {
          error: `Could not find coordinates for "${input.city}". Please check the city name.`,
        };
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else {
      latitude = input.latitude as number;
      longitude = input.longitude as number;
    }

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
    );

    const weatherData = await response.json();

    if (hasCity && input.city) {
      weatherData.cityName = input.city;
    }

    return weatherData;
  },
});
