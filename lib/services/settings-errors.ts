export class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsValidationError";
  }
}

export function getSettingsErrorResponse(error: unknown) {
  if (error instanceof SettingsValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  console.error(error);
  return Response.json(
    { error: "Something went wrong while processing account settings." },
    { status: 500 },
  );
}
