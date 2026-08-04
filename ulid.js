// extension/lib/ulid.js と同じ実装(拡張とPWAでIDの体系を揃えるため)
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(time) {
  let mod;
  let str = "";
  for (let len = TIME_LEN; len > 0; len--) {
    mod = time % ENCODING.length;
    str = ENCODING[mod] + str;
    time = (time - mod) / ENCODING.length;
  }
  return str;
}

function encodeRandom() {
  const bytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(bytes);
  let str = "";
  for (const b of bytes) str += ENCODING[b % ENCODING.length];
  return str;
}

export function ulid() {
  return encodeTime(Date.now()) + encodeRandom();
}
