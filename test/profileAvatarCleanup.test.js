/**
 * profileService · avatar files are actually deleted from disk.
 *
 * The bug this pins: removeAvatarFile resolved `path.join(PUBLIC_DIR, avatarUrl)`.
 * Uploads land in storage/uploads/avatars (uploadAvatar.js) — public/ is wiped by
 * a deploy, which is why they moved — and the stored value is
 * `/images/avatars/<file>?v=<ts>`, so the join produced a path under the wrong
 * root WITH a query string glued on. It matched nothing, every time.
 *
 * The consequence was not disk bloat. removeAvatar() cleared the database row
 * and left the image served at a filename that is stable per user, so a photo
 * the user had deleted stayed fetchable by anyone who knew the URL.
 *
 * STORAGE_DIR is set before the requires below because storagePaths.js freezes
 * STORAGE_PATHS at module load.
 */

const os   = require("os")
const fs   = require("fs")
const path = require("path")

const TMP_STORAGE = fs.mkdtempSync(path.join(os.tmpdir(), "muk-avatar-test-"))
const PREV_STORAGE_DIR = process.env.STORAGE_DIR
process.env.STORAGE_DIR = TMP_STORAGE

jest.mock("../src/lib/prisma", () => ({
  user: { findUnique: jest.fn(), update: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}))

const prisma = require("../src/lib/prisma")
const { STORAGE_PATHS } = require("../src/config/storagePaths")
const { removeAvatar, setAvatar } = require("../src/services/profileService")

const AVATAR_DIR = STORAGE_PATHS.avatars

function writeAvatar(name) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true })
  const file = path.join(AVATAR_DIR, name)
  fs.writeFileSync(file, "not-really-a-png")
  return file
}

beforeEach(() => {
  jest.clearAllMocks()
  prisma.user.update.mockResolvedValue({})
})

afterAll(() => {
  /* Put STORAGE_DIR back. A jest worker runs several test files in the same
   * process, and storagePaths.js resolves its base at require time — so
   * leaving this set pointed the NEXT file in the worker at a temp directory
   * that the line below had already deleted. That is what broke
   * test/integration/avatarUpload.int.test.js in CI while passing here: the
   * two files only share a worker under some orderings. Same cleanup that
   * file already does. */
  if (PREV_STORAGE_DIR === undefined) delete process.env.STORAGE_DIR
  else process.env.STORAGE_DIR = PREV_STORAGE_DIR
  fs.rmSync(TMP_STORAGE, { recursive: true, force: true })
})

test("removeAvatar deletes the file under storage/, not public/", async () => {
  const file = writeAvatar("user-abc.png")
  prisma.user.findUnique.mockResolvedValueOnce({ avatarUrl: "/images/avatars/user-abc.png" })

  await removeAvatar("abc")

  expect(fs.existsSync(file)).toBe(false)
})

test("the ?v= cache-buster does not defeat the delete", async () => {
  const file = writeAvatar("user-cache.png")
  // This is exactly the shape profileController writes.
  prisma.user.findUnique.mockResolvedValueOnce({ avatarUrl: `/images/avatars/user-cache.png?v=${Date.now()}` })

  await removeAvatar("cache")

  expect(fs.existsSync(file)).toBe(false)
})

test("replacing an avatar removes the previous file", async () => {
  const old = writeAvatar("user-old.png")
  prisma.user.findUnique.mockResolvedValueOnce({ avatarUrl: "/images/avatars/user-old.png?v=1" })

  await setAvatar("abc", "/images/avatars/user-new.png?v=2")

  expect(fs.existsSync(old)).toBe(false)
})

test("a doctored avatarUrl cannot delete outside the avatars directory", async () => {
  const outside = path.join(TMP_STORAGE, "keep-me.txt")
  fs.writeFileSync(outside, "must survive")
  prisma.user.findUnique.mockResolvedValueOnce({ avatarUrl: "/images/avatars/../../keep-me.txt" })

  await removeAvatar("evil")

  // basename() collapses the traversal, so the delete targets a file that does
  // not exist rather than walking up out of the avatars directory.
  expect(fs.existsSync(outside)).toBe(true)
})

test("a missing file is not an error — the row is still cleared", async () => {
  prisma.user.findUnique.mockResolvedValueOnce({ avatarUrl: "/images/avatars/never-existed.png" })

  await expect(removeAvatar("gone")).resolves.not.toThrow()
  expect(prisma.user.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { avatarUrl: null } })
  )
})

test("a null avatarUrl is a no-op", async () => {
  prisma.user.findUnique.mockResolvedValueOnce({ avatarUrl: null })

  await expect(removeAvatar("none")).resolves.not.toThrow()
})
