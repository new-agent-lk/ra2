import { describe, expect, it } from 'vitest';
import { callShim, createGuestMemory, createTestShim, readU32, writeU32 } from '../helpers/guestMemory';
import { GUEST_CALLBACK_BASE, GUEST_CALLBACK_STRIDE, HYPERCALL_CALLBACK_DEPTH } from '../../src/vm86/pe';
import { GAME_RESOLUTIONS } from '../../src/games/resolution';

function fixture() {
  const memory = createGuestMemory();
  const shim = createTestShim(memory, { gameId: 'ra2' });
  // DirectDrawCreate(out)
  const out = 0x1000;
  const result = callShim(shim, 'DDRAW.DLL!DirectDrawCreate', [0, out]);
  expect(result.eax).toBe(0);
  const object = readU32(memory, out);
  return { memory, shim, object };
}

describe('DirectDraw EnumDisplayModes', () => {
  it('returns DD_OK and generates one callback per registered candidate mode', () => {
    const { memory, shim, object } = fixture();
    const stack = 0x3000;
    const context = 0x402000;
    const callback = 0x403000;
    writeU32(memory, stack, 0x401000); // original return address
    const result = callShim(
      shim,
      'DDRAW.COM!IDirectDraw.EnumDisplayModes',
      [object, 0, 0, context, callback],
      stack,
    );
    expect(result.eax).toBe(0); // DD_OK
    // Trampoline address is written back to the stack.
    const bridge = readU32(memory, stack);
    expect(bridge).toBeGreaterThanOrEqual(GUEST_CALLBACK_BASE);
    // Trampoline resides within the callback area.
    expect(bridge - GUEST_CALLBACK_BASE).toBeLessThan(GUEST_CALLBACK_STRIDE);
    // Callback slot remains owned until the guest bridge tail releases it.
    expect(readU32(memory, HYPERCALL_CALLBACK_DEPTH)).toBeGreaterThanOrEqual(1);
  });

  it('reports every candidate mode dimension', () => {
    const { memory, shim, object } = fixture();
    const stack = 0x3000;
    const callback = 0x403000;
    writeU32(memory, stack, 0x401000);
    callShim(shim, 'DDRAW.COM!IDirectDraw.EnumDisplayModes', [object, 0, 0, 0, callback], stack);
    const bridge = readU32(memory, stack);
    // The trampoline calls the guest callback once per candidate; verify the generated machine code
    // contains the expected number of "call eax" instructions (0xff 0xd0).
    const trampoline = memory.bytes.subarray(bridge, bridge + GUEST_CALLBACK_STRIDE);
    let callCount = 0;
    for (let i = 0; i + 1 < trampoline.length; i++) {
      if (trampoline[i] === 0xff && trampoline[i + 1] === 0xd0) callCount++;
    }
    expect(callCount).toBe(GAME_RESOLUTIONS.length);
  });
});
