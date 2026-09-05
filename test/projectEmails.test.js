// ─────────────────────────────────────────────────────────────────────────────
// T5-6 · the sender.
//
// Six call sites, one variable bag. What is guarded here is everything that
// would otherwise be six chances to get wrong: the tracking code that must be
// on every one of them, the recipient (one of these emails goes to the
// operator, not the client), the events the status email is allowed to quote,
// and the two cases that must send NOTHING.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../src/lib/prisma", () => ({
  user: { findUnique: jest.fn() },
  projectFileRequest: { count: jest.fn() },
}))
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }))
jest.mock("../src/services/emailService", () => ({
  sendTemplateEmail: jest.fn().mockResolvedValue({ ok: true }),
}))
jest.mock("../src/services/projectEventService", () => ({
  listForProject: jest.fn().mockResolvedValue([]),
  serializeEvent: jest.fn((e) => e),
}))

const prisma = require("../src/lib/prisma")
const { sendTemplateEmail } = require("../src/services/emailService")
const projectEvents = require("../src/services/projectEventService")
const projectEmails = require("../src/services/projectEmailService")

const PROJECT = {
  id: "p1",
  userId: "u1",
  projectName: "Website rebuild",
  trackingCode: "MU-7K4C-9XQF",
  assignedAdminId: null,
}

const REQUEST = {
  id: "r1",
  title: "Signed service agreement",
  titleEs: "Contrato de servicio firmado",
  instructions: "All pages, scan or photo.",
  instructionsEs: "Todas las páginas, escaneo o foto.",
  acceptExt: ".pdf,.jpg",
  dueAt: new Date("2026-09-20T00:00:00Z"),
  status: "requested",
  reviewNote: null,
}

const sent = () => sendTemplateEmail.mock.calls[0]?.[0]

beforeEach(() => {
  jest.clearAllMocks()
  process.env.FRONTEND_URL = "https://mustaphaukizuru.com"
  prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "client@example.com", fullName: "Ana Ruiz" })
  prisma.projectFileRequest.count.mockResolvedValue(0)
  projectEvents.listForProject.mockResolvedValue([])
})

describe("the tracking code is not optional", () => {
  test("it is on every send", async () => {
    await projectEmails.sendTrackingCodeEmail("u1", PROJECT, { locale: "en" })
    expect(sent().variables.trackingCode).toBe("MU-7K4C-9XQF")
  })

  test("a project without one sends NOTHING rather than a literal placeholder", async () => {
    // The templates are seeded rows: an unresolved {{trackingCode}} does not
    // throw, it renders as those characters in the client's inbox. Projects
    // created before T5-1 have no code until the backfill script runs.
    const ok = await projectEmails.sendTrackingCodeEmail("u1", { ...PROJECT, trackingCode: null })
    expect(ok).toBe(false)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("an unknown template key is refused", async () => {
    const ok = await projectEmails.send({ project: PROJECT, templateKey: "project.made-up", to: "a@b.c" })
    expect(ok).toBe(false)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("no recipient sends nothing", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", email: null })
    expect(await projectEmails.sendFileRequested({ project: PROJECT, request: REQUEST })).toBe(false)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("every variable reaches the template as a string", async () => {
    // A null in the bag is the same literal-placeholder problem by another
    // route, depending on the renderer's mood.
    await projectEmails.sendFileRequested({
      project: PROJECT,
      request: { ...REQUEST, dueAt: null, acceptExt: null },
      locale: "en",
    })
    for (const value of Object.values(sent().variables)) {
      expect(typeof value).toBe("string")
    }
  })
})

describe("the links", () => {
  test("markup-bearing variables are named *Html, and plain ones are not", async () => {
    // The renderer escapes every variable that does not end in "Html", which
    // is right — most of them are user text landing in an HTML body. These
    // are the exceptions, and the first in the codebase to use the suffix.
    // Getting it wrong ships visible "&lt;strong&gt;" to a client.
    await projectEmails.sendFileRequested({ project: PROJECT, request: REQUEST, locale: "en" })
    const vars = sent().variables
    for (const [name, value] of Object.entries(vars)) {
      if (/<[a-z/]/i.test(value)) expect(name.endsWith("Html")).toBe(true)
    }
    expect(vars.instructionsHtml).toContain("<span")
    expect(vars.instructionsText).not.toContain("<")
  })

  test("a due date is read as a DAY, not an instant in the server's zone", async () => {
    // Stored midnight UTC on the 20th, it rendered as "September 19" in
    // Mexico City — a deadline moved by a formatting choice.
    await projectEmails.sendFileRequested({ project: PROJECT, request: REQUEST, locale: "en" })
    expect(sent().variables.dueText).toBe("Due September 20, 2026.")
  })

  test("the request email lands on the row, not the page", async () => {
    // FileRequestPanel highlights ?request=<id> on arrival (T5-5). Without
    // it the client lands on a page with eight rows and has to guess.
    await projectEmails.sendFileRequested({ project: PROJECT, request: REQUEST, locale: "en" })
    expect(sent().variables.requestUrl)
      .toBe("https://mustaphaukizuru.com/dashboard/projects/p1?request=r1")
  })

  test("the tracking URL carries the code, so the client never types it", async () => {
    await projectEmails.sendTrackingCodeEmail("u1", PROJECT, { locale: "en" })
    expect(sent().variables.trackUrl).toBe("https://mustaphaukizuru.com/track/MU-7K4C-9XQF")
  })
})

describe("language", () => {
  test("a Spanish reader gets the Spanish title and instructions", async () => {
    await projectEmails.sendFileRequested({ project: PROJECT, request: REQUEST, locale: "es" })
    expect(sent().locale).toBe("es")
    expect(sent().variables.requestTitle).toBe("Contrato de servicio firmado")
    expect(sent().variables.instructionsText).toBe("Todas las páginas, escaneo o foto.")
  })

  test("a request with no Spanish text falls back to English rather than blank", async () => {
    await projectEmails.sendFileRequested({
      project: PROJECT,
      request: { ...REQUEST, titleEs: null, instructionsEs: null },
      locale: "es",
    })
    expect(sent().variables.requestTitle).toBe("Signed service agreement")
  })
})

describe("the review emails", () => {
  test("accepted counts what is still outstanding", async () => {
    prisma.projectFileRequest.count.mockResolvedValue(2)
    await projectEmails.sendFileReviewed({
      project: PROJECT, request: { ...REQUEST, status: "accepted" }, locale: "en",
    })
    expect(sent().templateKey).toBe("project.file-accepted")
    expect(sent().variables.remainingLine).toMatch(/2 more documents/)
  })

  test("nothing outstanding says so, rather than saying nothing", async () => {
    await projectEmails.sendFileReviewed({
      project: PROJECT, request: { ...REQUEST, status: "accepted" }, locale: "en",
    })
    expect(sent().variables.remainingLine).toMatch(/not waiting on anything else/i)
  })

  test("rejected carries the note, because the note is the email", async () => {
    await projectEmails.sendFileReviewed({
      project: PROJECT,
      request: { ...REQUEST, status: "rejected", reviewNote: "Page 3 is missing." },
      locale: "en",
    })
    expect(sent().templateKey).toBe("project.file-rejected")
    expect(sent().variables.reviewNote).toBe("Page 3 is missing.")
  })

  test("the review note is passed RAW, for the renderer to escape", async () => {
    // Operator free text landing inside a callout card. It must be escaped
    // exactly once: the renderer does it for every variable not named *Html,
    // and doing it here as well shipped "&amp;lt;" to the reader.
    const note = 'Use <b>the "final" one</b>'
    await projectEmails.sendFileReviewed({
      project: PROJECT,
      request: { ...REQUEST, status: "rejected", reviewNote: note },
      locale: "en",
    })
    expect(sent().variables.reviewNote).toBe(note)
    expect(Object.keys(sent().variables)).not.toContain("reviewNoteHtml")
  })

  test("CANCELLED sends nothing", async () => {
    // "We no longer need the thing we asked you for" is worth a bell badge
    // and not worth an email.
    const ok = await projectEmails.sendFileReviewed({
      project: PROJECT, request: { ...REQUEST, status: "cancelled" },
    })
    expect(ok).toBe(false)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })
})

describe("the operator's email", () => {
  test("goes to the assigned admin, not the client", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "a1", email: "admin@example.com", fullName: "Admin" })
    await projectEmails.sendFileReceived({
      project: { ...PROJECT, assignedAdminId: "a1" },
      request: REQUEST,
      file: { fileName: "contract.pdf" },
      client: { fullName: "Ana Ruiz" },
    })
    expect(sent().to).toBe("admin@example.com")
    expect(sent().to).not.toBe("client@example.com")
  })

  test("falls back to the support address when nobody is assigned", async () => {
    process.env.SUPPORT_EMAIL = "hola@mustaphaukizuru.com"
    await projectEmails.sendFileReceived({
      project: PROJECT, request: REQUEST, file: { fileName: "contract.pdf" }, client: { fullName: "Ana" },
    })
    expect(sent().to).toBe("hola@mustaphaukizuru.com")
  })

  test("it is the only one that names the file", async () => {
    await projectEmails.sendFileReceived({
      project: PROJECT, request: REQUEST, file: { fileName: "contract.pdf" }, client: { fullName: "Ana" },
    })
    expect(sent().variables.fileName).toBe("contract.pdf")
  })
})

describe("the status update", () => {
  test("quotes events at the CLIENT ceiling, never the admin one", async () => {
    // Asking for "admin" here would put operator notes in a client's inbox,
    // and the mistake would be one word long.
    await projectEmails.sendStatusUpdate({ project: PROJECT, status: "review", locale: "en" })
    expect(projectEvents.listForProject).toHaveBeenCalledWith("p1", { audience: "client", limit: 3 })
  })

  test("an unknown status sends nothing", async () => {
    expect(await projectEmails.sendStatusUpdate({ project: PROJECT, status: "banana" })).toBe(false)
    expect(sendTemplateEmail).not.toHaveBeenCalled()
  })

  test("no recorded activity still produces a readable email", async () => {
    await projectEmails.sendStatusUpdate({ project: PROJECT, status: "in_progress", locale: "en" })
    expect(sent().variables.recentEventsHtml).toMatch(/No activity recorded yet/i)
    expect(sent().variables.recentEventsHtml).not.toContain("undefined")
  })

  test("it tells the client what is still owed", async () => {
    prisma.projectFileRequest.count.mockResolvedValue(1)
    await projectEmails.sendStatusUpdate({ project: PROJECT, status: "review", locale: "en" })
    expect(sent().variables.outstandingLine).toMatch(/1 document from you/)
  })
})

describe("failures stay quiet", () => {
  test("a template that is missing or inactive is logged, not thrown", async () => {
    sendTemplateEmail.mockResolvedValue({ ok: false, error: "Template not found" })
    await expect(
      projectEmails.sendTrackingCodeEmail("u1", PROJECT),
    ).resolves.toBe(false)
  })

  test("a transport throw does not escape", async () => {
    // An email is a record of something that already happened. Losing the
    // send must never roll back the thing it describes.
    sendTemplateEmail.mockRejectedValue(new Error("SMTP down"))
    await expect(projectEmails.sendTrackingCodeEmail("u1", PROJECT)).resolves.toBe(false)
  })

  test("a recipient lookup failure does not escape either", async () => {
    prisma.user.findUnique.mockRejectedValue(new Error("db gone"))
    await expect(projectEmails.sendTrackingCodeEmail("u1", PROJECT)).resolves.toBe(false)
  })
})
