import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  isScrollContainerNearBottom
} from '../src/renderer/src/lib/chat-scroll.ts'

test('isScrollContainerNearBottom', async (t) => {
  await t.test('returns true when already at bottom', () => {
    assert.equal(
      isScrollContainerNearBottom({
        scrollTop: 600,
        clientHeight: 400,
        scrollHeight: 1000
      }),
      true
    )
  })

  await t.test('returns true when within the auto-scroll threshold', () => {
    assert.equal(
      isScrollContainerNearBottom({
        scrollTop: 540,
        clientHeight: 400,
        scrollHeight: 1000
      }),
      true
    )
  })

  await t.test('returns false when the user is meaningfully above the bottom', () => {
    assert.equal(
      isScrollContainerNearBottom({
        scrollTop: 520,
        clientHeight: 400,
        scrollHeight: 1000
      }),
      false
    )
  })

  await t.test('clamps negative thresholds to zero', () => {
    assert.equal(
      isScrollContainerNearBottom(
        {
          scrollTop: 539,
          clientHeight: 400,
          scrollHeight: 1000
        },
        -1
      ),
      false
    )
  })

  await t.test('falls back to the default threshold for NaN', () => {
    assert.equal(
      isScrollContainerNearBottom(
        {
          scrollTop: 540,
          clientHeight: 400,
          scrollHeight: 1000
        },
        NaN
      ),
      true
    )
    assert.equal(AUTO_SCROLL_BOTTOM_THRESHOLD_PX, 64)
  })

  await t.test('returns true when all values are non-finite (safe default)', () => {
    assert.equal(
      isScrollContainerNearBottom({
        scrollTop: NaN,
        clientHeight: NaN,
        scrollHeight: NaN
      }),
      true
    )
  })

  await t.test('returns true when distance equals threshold exactly', () => {
    // distance = 1000 - 400 - 536 = 64 (equals default threshold)
    assert.equal(
      isScrollContainerNearBottom({
        scrollTop: 536,
        clientHeight: 400,
        scrollHeight: 1000
      }),
      true
    )
  })

  await t.test('returns false when distance is one pixel beyond threshold', () => {
    // distance = 1000 - 400 - 535 = 65 (one more than default 64)
    assert.equal(
      isScrollContainerNearBottom({
        scrollTop: 535,
        clientHeight: 400,
        scrollHeight: 1000
      }),
      false
    )
  })
})
