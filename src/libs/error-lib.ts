export class Logger {
  static logError(error: Error) {
    console.error(`Error: ${error.name}: ${error.message}`);
  }
}
