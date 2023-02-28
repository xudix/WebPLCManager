
// pipe allows a series of functions to be applied on an object
export function pipe(...fns) {
    return (x) => fns.reduce((v, f) => f(v), x);
}