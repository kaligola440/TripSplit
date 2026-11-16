type TripValues = {
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  currency: string;
};

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isTripId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function validateTrip(formData: FormData):
  | { success: true; data: TripValues }
  | { success: false; fieldErrors: Record<string, string> } {
  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const name = read("name");
  const description = read("description");
  const startDate = read("startDate");
  const endDate = read("endDate");
  const currency = read("currency").toUpperCase();
  const fieldErrors: Record<string, string> = {};

  if (!name || Array.from(name).length > 120) {
    fieldErrors.name = "Enter a trip name of 1 to 120 characters.";
  }
  if (Array.from(description).length > 5000) {
    fieldErrors.description = "Description must be 5,000 characters or fewer.";
  }
  if (!isDate(startDate)) {
    fieldErrors.startDate = "Enter a valid start date.";
  }
  if (endDate && !isDate(endDate)) {
    fieldErrors.endDate = "Enter a valid end date.";
  } else if (endDate && isDate(startDate) && endDate < startDate) {
    fieldErrors.endDate = "End date cannot be earlier than start date.";
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    fieldErrors.currency = "Enter a three-letter currency code, such as EUR.";
  }

  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return {
    success: true,
    data: {
      name,
      description: description || null,
      start_date: startDate,
      end_date: endDate || null,
      currency,
    },
  };
}
