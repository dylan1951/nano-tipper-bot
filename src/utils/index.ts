export function extractNanoAddress(input: string): string | null {
    const nanoAddressPattern = /nano_[13][13456789abcdefghijkmnopqrstuwxyz]{59}/g;
    const match = input.match(nanoAddressPattern);
    return match ? match[0] : null;
}