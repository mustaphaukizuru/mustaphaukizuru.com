import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "first-robotics-class-from-scratch",
  title: "Running your first robotics class from scratch",
  excerpt:
    "A budget-aware, hands-on curriculum that takes Grade 6–9 students from a blinking LED to an autonomous line-following robot in one term.",
  category: "stem-education",
  tags: ["Robotics", "Schools", "Mexico"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2026-02-28T09:00:00Z",
  readMinutes: 10,
  cover: null,
  featured: false,
  body: [
    { type: "p", text: "Robotics has the highest joy-per-peso ratio of any STEM topic I've taught. Students who never raise their hand in maths suddenly negotiate motor wiring with the kid next to them. The whole class becomes a workshop." },
    { type: "p", text: "Here's the term I run with Grade 6–9, total budget under $400 for a class of 24 working in pairs." },

    { type: "h2", text: "The kit" },
    { type: "list", items: [
      "**Microcontroller**, Arduino UNO clones, $4 each at scale. Bulletproof, well-documented, infinite community.",
      "**Sensors**, line-tracking IR sensors, ultrasonic distance sensor, push buttons. Around $1 each.",
      "**Actuators**, pair of yellow TT motors with wheels, micro servo. $3 per pair.",
      "**Chassis**, laser-cut acrylic or 3D-printed; we use a school-printed plate.",
      "**Power**, 4×AA holder. Resist the urge to use Li-ion for a beginner class, the safety overhead is real.",
    ] },

    { type: "h2", text: "12-week curriculum at a glance" },
    { type: "ordered", items: [
      "**Weeks 1–2**, Blink. Read a button. Output to serial. Learn to *fail and recover*.",
      "**Weeks 3–4**, Drive a motor. Drive two motors. Make the robot move in a square.",
      "**Weeks 5–6**, Read the IR line sensors. Hand-tune a basic line follower.",
      "**Weeks 7–8**, Add the ultrasonic. Stop before the wall. Avoid obstacles.",
      "**Weeks 9–10**, Project sprint: pairs design their own robot challenge.",
      "**Weeks 11–12**, Demo day. Parents invited. Students run the room.",
    ] },

    { type: "h2", text: "What I wish I'd known the first time" },
    { type: "list", items: [
      "**Buy spares of every cable.** Jumper wires die mysteriously. Plan for 30% loss.",
      "**Number every kit.** Reduces \"whose breadboard is this?\" by 90%.",
      "**Photograph completed circuits.** Students rebuild faster from a photo than from a schematic.",
      "**Start every class with a 3-minute demo of a previous student's robot.** Aspiration is the curriculum.",
    ] },

    { type: "callout", variant: "success", title: "The real outcome", text: "After one term, the loudest signal is not the working robots, it's how many students start asking what's next. That's where electives and clubs are born." },
  ],
}
