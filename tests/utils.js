// Skip tests if condition is true
export const skipIf = (condition) => {
  if (condition) {
    return test.skip;
  }
  return test;
};
