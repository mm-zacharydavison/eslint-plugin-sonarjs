// -- Methods

class MyClass {
  returnNothing() {}
  returnNumberUntyped() {
    return 1;
  }
  returnNumberTyped(): number {
    return 1;
  }
}

// -- Functions

function returnNothing() {}
function returnNumberUntyped(): number {
  return 1;
}
function returnNumberTyped(): number {
  return 1;
}

export { MyClass, returnNumberUntyped, returnNumberTyped, returnNothing };
