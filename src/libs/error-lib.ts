export function reportError(e: unknown) {
  const error = e as Error;
  console.error(`${error.name}: ${error.message}`);

  // console.log("---------------");
  // console.error(e);
  // console.log("---------------");
}
