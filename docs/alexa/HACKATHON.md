# Build, Ship, Shape: what the Alexa+ track judges

Captured 2026-10-08 from the Devpost site with curl (browser UA). Every page listed below returned HTTP 200 and was read in full unless marked "not opened". Quotes are verbatim. When the overview page, the rules and the FAQ disagree, the rules say: "If there is any discrepancy or inconsistency between the terms and conditions of the Official Rules and disclosures or other statements contained in any Hackathon materials ... the terms and conditions of the Official Rules shall prevail." (https://amazonappdev2026.devpost.com/rules)

Source key:
- OV = https://amazonappdev2026.devpost.com/
- RU = https://amazonappdev2026.devpost.com/rules
- RE = https://amazonappdev2026.devpost.com/resources
- FQ = https://amazonappdev2026.devpost.com/details/faqs
- DA = https://amazonappdev2026.devpost.com/details/dates
- UP = https://amazonappdev2026.devpost.com/updates
- FT/<id> = https://amazonappdev2026.devpost.com/forum_topics/<id>

## Track

The overview's Alexa+ definition (OV):

> Experience how brands in Preview are building and shipping experiences on Alexa+ that our customers love:
> - Build a self-hosted MCP server (spec 2025-11-25 or later, Streamable HTTP) or an Agent Skill. MCP is the open standard that powers Alexa+ integrations.
> - New to MCP? Build a simulated Alexa+ experience in a web app using your preferred agentic tool.

The rules' Project Requirements definition (RU, section 4):

> Alexa+: Build a working Agent Skill or a self-hosted MCP server, implementing MCP spec version (minimum acceptable version is 2025-11-25). Optionally, developers can simulate the Alexa+ experience in a web app using their own agentic tools.

The rules' Submission Requirements definition (RU, section 4):

> Alexa+: A working Agent Skill or a self-hosted MCP server, implementing MCP spec version 2025-11-25 (or a later version, once confirmed) over Streamable HTTP. Alternatively, entrants may submit a simulated Alexa+ experience instead — built using any AI or agentic tool of their choice, no specific framework, SDK, or MCP-shaped surface required. This alternate path is exempt from the runtime-technology-hook requirement above; the code repository must still include the simulation's source code, and the demo video must clearly show the simulated experience.

The runtime-hook requirement that the MCP path must meet (RU):

> For Alexa+, Bee, and Ring: The repository must demonstrate use of your track's required technology at runtime in your code — imported and actually called (a library import, an app/backend entry point, or a loaded agent/flow/MCP config), not just named in the README.

The Resources page says (RE): "Build a working MCP (Model Context Protocol) integration on the open standards for Agent Skills and Streamable HTTP transports. You can simulate an Alexa+ experience using your preferred agentic tools via a web app."

Nobody outside select partners can reach real Alexa+. FAQ (FQ):

> Will hackathon participants get access to the gated Alexa+ developer tools (Category SDK, MCP Toolkit, CLI, or Web Simulator)? Answer: No. Amazon's Alexa+ Add-on developer tools (Category SDK, MCP Toolkit, CLI, and Web Simulator) are in preview and available to select partners only - there is currently no way for hackathon participants to apply for or gain access. ... You do not need these tools for your submission: build a self-hosted MCP server (or Agent Skill) per the Official Rules, and demo it via your own web-based simulator or front end.

A web MCP client counts as the demo surface (FQ):

> For the Alexa+ track, can I demo my self-hosted MCP server through a web page that acts as a real MCP client, instead of a device? Answer: Yes. A web page that acts as an actual MCP client (sending initialize, tools-list, and tools-call requests over Streamable HTTP) satisfies the requirement - this is the simulated-experience path the Resources page points to, since there's no way for any participant to connect a self-hosted MCP server to a real Alexa+ device or developer console (that tooling is select-partners-only). Showing an existing AI assistant app calling the same server is a nice bonus, but not required.

Organizer answers (Emerson Sklar, Chief Evangelist, Alexa, who is also a judge per OV):

- What scores well (FT/45397-what-exactly-are-you-looking-for-in-the-alexa-track): "a strong fit would be something that you could really see people actually using on Alexa+, which brings new functionality to the platform or unlocks new experiences that are only possible in the current age of AI. Something that is a latent capability of modern LLMs or an existing feature of Alexa+ might score highly on Tech Implementation but would likely score poorly on Design and 'Quality of the Idea'." Also: "Alexa+ is a generally a consumer-focused personal assistant." On integration level: "None whatsoever. There is no way for you to actually integrate with Alexa+". On multimodal: "It could and should be part of a broader multimodal experience ... Alexa is a voice-first platform, but not voice-only, and users expect a rich multimodal experience when using a device with a screen." And: "Your submission can go into multiple tracks (though can only win 1)".
- What the simulated path needs (FT/45058-clarification-on-simulated-alexa-web-experience-requirements): an Alexa-like look is not required, "but that certainly helps with the Design portion"; a live agent answering dynamically is not required; "Voice input/output is not required"; custom UI for cards and results, "Absolutely"; identifying it as an Alexa+ simulation is "Not required"; a real backend with only the Alexa+ layer simulated, "Yes". For design references he points to https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide-overview.html and https://apl.ninja/. For the video: "It just must look / feel / sound / etc. like it's actually functional and be something that could reasonably be an interesting use case on Alexa." A later reply in the same thread accepts a simulation with deterministic runtime rules built with an AI dev tool.
- Capabilities add-ons don't have (FT/45199-alexa-mcp-can-an-add-on-initiate-alexa-to-alexa-calling-or-drop-in): "you cannot invoke this functionality via add-ons today. However, you absolutely could demo it as part of your submission (since the submissions and judging criteria aren't bound by the publicly documented addon capabilities)."
- Toolkit, CLI and AWS role access (FT/45262-is-the-alexa-mcp-toolkit-alexa-ai-cli-available-to-hackathon-participants, FT/45255-..., FT/45256-alexa-web-simulator, FT/45403-testing): "Access to the Alexa+ developer tools will not be granted to hackathon participants, nor will setting that AWS account role." A participant reported that `npm install -g @alexa-ai/cli` returns 404 on public npm.

## Deadlines

All times Pacific.

| Event | Rules (RU, section 1) | Schedule page (DA) |
|---|---|---|
| Submissions open | Mon Aug 31, 2026, 10:15 am PT | Aug 31, 10:15am PDT |
| **Submissions close** | **Fri Oct 23, 2026, 12:00 pm PT** | Oct 23, 12:00pm PDT |
| Judging | Mon Nov 9, 12:00 pm PT to Fri Nov 20, 12:00 pm PT | Oct 26, 12:00pm PDT to Nov 20, 12:00pm PST |
| Winners announced | On or around Thu Dec 3, 12:00 pm PT | Dec 03, 12:00pm PST |

The two judging start dates disagree; the rules prevail. Plan for judges looking from Oct 26. The overview also shows "October 23 at 3:00pm EDT to deadline" (OV), which is the same instant as 12:00 pm PDT.

Other dates:
- AWS credit requests were due Oct 21, 12pm PT, but RU and RE now say: "October 7th Update: We are out of credit codes and will no longer be accepting credit requests."
- Office Hours #2: Monday, October 19, 11:00 am to 12:00 pm CT (9:00 am PT), registration at https://amazon.zoom.us/webinar/register/WN_kh9CSYi0QtuN31d8nsTuOQ (UP, post "Office Hours Schedule"). Office Hours #1 (Oct 6) has passed.
- After the close: "Once the Submission Period has ended, you may not make any changes or alterations to your Submission" (RU, section 5).

## Eligibility

- "Individuals who are at least the age of majority where they reside as of the time of entry", Teams of such individuals, and existing Organizations (RU, section 3). The overview says "Above legal age of majority in country of residence" (OV). Every NYC-MON team member has to be an adult.
- Excluded: residents of "Brazil, Quebec, Russia, Crimea, Cuba, Iran, and North Korea" and OFAC-sanctioned countries; Sponsor/Devpost employees and their families; "Any Judge (defined below), or company or individual that employs a Judge" (RU, section 3).
- A team must name one Representative who submits (RU, section 3). No team size cap (FQ).
- "A Project must not have been developed, or derived from a Project developed, with financial or preferential support from the Sponsor or Administrator" (RU, section 4).
- New or existing: "if the Entrant's Project existed prior to the Hackathon Submission Period, must have been significantly updated after the start of the Hackathon Submission Period. Entrants must explain how their Project was significantly updated – clearly describe and demo the feature updates during the Submission Period" (RU). The FAQ adds: "A new conversational feature that brings new functionality to an existing app can count as a significant update - focus your demo on a clear before-and-after" (FQ).
- Mini challenges only stack on a primary-track entry (FT/45310-question-related-to-mini-challenge, Devpost manager): "Mini challenges are only allowed on top of the main track submission!"

## Submission requirements (checklist)

Every item cites its source. Items marked (opt) are optional.

- [ ] Project built with the required tools and meeting Project Requirements (RU).
- [ ] **Text description** of features and functionality (RU; OV: "explain what it does and how it works").
- [ ] **GitHub repo URL**. GitHub only, no GitLab (FQ). "The repository must contain all necessary source code, assets, and instructions required for the project to be functional" (RU).
  - [ ] Either public, with an open-source license "detectable and visible at the top of the repository page (in the About section)" (RU),
  - [ ] or private, with collaborators `chris-trag`, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar` plus `testing@devpost.com` (RU; UP "Got an idea?"; FT/45264-...). "each person has to accept the invitation, and GitHub invitations expire after 7 days. Add the reviewers when you submit rather than weeks in advance" (OV). The FAQ omits `chris-trag` from its list; the rules include it, so invite all six.
- [ ] **Runtime hook (MCP path)**: the MCP server is imported and called in code, not just named in the README (RU). Not required on the pure simulated path, which still needs the simulation source in the repo (RU).
- [ ] **MCP spec 2025-11-25 or later over Streamable HTTP**, or an Agent Skill (RU).
- [ ] **Setup and run instructions**: "The Project's code repository must include clear setup and run instructions" (RU, Functionality).
- [ ] **Testing access**: "If Entrant's website is private, Entrant must include login credentials in its testing instructions. The Entrant must make the Project available free of charge and without any restriction, for testing, evaluation and use by the Sponsor, Administrator and Judges until the Judging Period ends" (RU, Testing). Credentials go "At least in the testing instructions, but should be easily findable wherever relevant" (FT/45430-inquiry-about-submission-mechanics). Hosting is optional: "A locally runnable public repo plus your demo video is enough - judges can download, build, and test it themselves, so hosting isn't required" (FQ).
- [ ] **Demo video**: "less than three (3) minutes. Judges are not required to watch beyond three minutes"; "footage that shows the Project functioning on the device for which it was built"; "uploaded to and made publicly visible on YouTube or Vimeo"; "must not include third party trademarks, or copyrighted music or other material unless the Entrant has permission" (RU). Must be in English (OV; RU, Language Requirements). For Alexa+: "show your Agent Skill or MCP server (spec 2025-11-25+, Streamable HTTP) in action" (OV).
- [ ] **Product feedback for every tool, API or SDK used**: which ones and for what, what worked, what needs work, onboarding from zero to hello world, and "Would you build with these devices and services again? Yes/No and please tell us why" (RU). The update post says to be specific: "'the docs were confusing' doesn't help anyone without naming the tool" (UP, "Strong Submission Tips").
- [ ] **Track(s) and mini challenge(s)** you are entering (RU). One project can be judged in two tracks and win only one (FT/45333-...).
- [ ] **AWS Builder**: "Describe which AWS service(s) you used and how, in your Product Feedback answer" (RU).
- [ ] **Open Source**: "contribution URL, project repository URL, GitHub username, and a description of what you did, how it works, and why it matters" (RU).
- [ ] **Pre-existing project**: explain and demo what changed during the window (RU; OV).
- [ ] (opt) Feature requests, each with "description, why it matters to their project, and priority rating (Critical / Important / Nice-to-have)" (RU).
- [ ] (opt, worth up to 10%) **Friction log entries**, each with "specific task attempted, steps taken, expected vs. actual result, severity rating, workaround used, and actionable suggestion" (RU). A link in the description is enough, and keeping the log in the repo is "certainly easier for judges" (FT/45430-...).
- [ ] Tips from the "Strong Submission Tips" update (UP): name the track's tool in the description and the Built With section and call it out in the video; keep API keys out of the repo; "Treat your video like a pitch, not a tutorial"; give the project a memorable, specific name.

## Judging criteria

Stage One is pass/fail: "whether the ideas meet a baseline level of viability, in that the Project reasonably fits the theme and reasonably applies the required APIs/SDKs featured in the Hackathon" (RU, section 6).

Stage Two uses "the following equally weighted criteria" (RU). Each is scored 1 to 5: "Every submission is scored 1 to 5 on four equally weighted criteria" (UP, "Got an idea?"). That gives 25% per criterion, with ties broken in this order:

1. **Tech Implementation**: "How well is the project built, and how effectively does it use the required tech? Does it effectively leverage the required APIs, SDKs, or device capabilities for the specified track (Fire TV, Alexa+, Bee, or Ring) or mini-challenge (AWS Builder, Open Source)?"
2. **Design**: "Does the project deliver a complete, coherent product experience? Is the interaction model intuitive and well-considered for the target device or platform?"
3. **Potential Impact**: "Does the project make a credible, specific case for solving customer needs? Could it realistically serve an audience beyond the hackathon?"
4. **Quality of the Idea**: "Is this a creative, imaginative use of the required tools? Does the team demonstrate a genuine understanding of the developer ecosystem and the end-user needs within their chosen track?" For Alexa+: "Obvious: single-turn Q&A bot, basic MCP wrapper around an existing API. Creative: agentic workflow that orchestrates across services autonomously, context-aware add-on that maintains state across sessions, purchasing capabilities, media support (cards, carousels, etc), [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview), Agent Skills."

Bonus (RU): "During Stage 1 downselection, Amazon's internal review team assesses each submission's friction log entries (if provided) and passes a recommended bonus — up to 10% — to the Stage 2 judging panel".

Method (RU): "This process may utilize expert panels, peer review, automated AI-driven analysis, or any combination thereof". Also: "Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video provided in the Submission."

Alexa judges listed on OV: Karthik Ragubathy (Senior Solutions Architect, Alexa), Emerson Sklar (Chief Evangelist, Alexa), Saylee Joshi (Senior Solutions Architect, Alexa). The panel also includes VP, AWS and Callstack judges.

Prizes for Alexa+ (OV; RU, section 8): 1st $25,000 + $15,000 AWS credits + meeting with the Amazon Developer team + featured; 2nd $15,000 + $5,000 credits; 3rd $4,000 + $1,000 credits. AWS Builder and Open Source each pay $5,000 + $5,000 credits. "A project can only win one (1) track prize and one (1) mini challenge prize." (RU)

## Resources

| Name | URL | What it is | Relevance to an MCP server + web simulator |
|---|---|---|---|
| MCP getting started (named in rules "How To Enter") | https://modelcontextprotocol.io/docs/latest/getting-started/intro | Official MCP intro docs (RU) | The base reference the rules name for the Alexa+ track. HTTP 200, not read in depth. |
| Streamable HTTP transport, spec 2025-11-25 | https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http | The transport spec section (RE) | Hard requirement for the MCP path. The server must implement it and the simulator must speak it as a client. HTTP 200. |
| Build with Agent Skills (MCP Apps) | https://apps.extensions.modelcontextprotocol.io/api/#build-with-agent-skills | MCP Apps extension docs. The section ships four Agent Skills (`create-mcp-app`, `migrate-oai-app`, `add-app-to-server`, `convert-web-app`) that scaffold MCP Apps with interactive UI; repo https://github.com/modelcontextprotocol/ext-apps, spec version 2026-01-26 (RE; page read) | This is how to add interactive UI (cards) to MCP tools. MCP Apps and Agent Skills are both named "Creative" in the Alexa+ judging examples (RU). |
| MCP Apps overview | https://modelcontextprotocol.io/extensions/apps/overview | Linked from the Alexa+ "Creative" judging example (RU) | Same as above. HTTP 200, not read in depth. |
| Amazon Devices Builder Tools | https://developer.amazon.com/docs/vega/0.24/mcp-server (redirects to https://developer.amazon.com/docs/adbt/get-started.html) | npm MCP server + Agent Skills for coding assistants. Install: `npx -y @amazon-devices/amazon-devices-buildertools-mcp@latest init-context`. "full support for Vega OS and limited support for Fire OS"; the page does not mention Alexa+ or Ring (RE; get-started page read via WebFetch) | Low for Alexa+. Useful only as a tool to write product feedback and friction-log entries about, or if we also enter Fire TV. |
| Vega MCP server docs (latest) | https://developer.amazon.com/docs/vega/latest/mcp-server.html | Same tool, linked in the build-session recap (UP) | As above. |
| Alexa+ MCP add-on design guide | https://developer.amazon.com/docs/alexaplus/add-ons/mcp-addon-design-guide-overview.html | Public Alexa+ add-on design guide with mocks; the organizer points simulator builders here (FT/45058) | High for the Design criterion: fragment and full-screen patterns to imitate in the simulator. HTTP 200, only the title was read. |
| APL Ninja | https://apl.ninja/ | Third-party APL mock-up tool, suggested by the organizer (FT/45058) | Optional, for mocking Alexa visuals. Not opened. |
| Amazon Developer documentation | https://developer.amazon.com/docs/apps-and-games/documentation.html | Specs and guides across Amazon devices (RE) | Low. Not opened. |
| Sample code on GitHub | https://github.com/amazonappdev | AmazonAppDev org: reference apps and starters (RE). HTTP 200. | The listed samples cover Fire TV and Ring. None is for Alexa+. |
| Developer Community forum | https://community.amazondeveloper.com/c/fire-apps/17 and https://community.amazondeveloper.com/ | Q&A forum for Fire TV, Alexa and Ring (RE) | Support channel. HTTP 200, not read. |
| AmazonAppDev YouTube | https://www.youtube.com/channel/UCT9ApARFgQJOeqD-ygmxnJQ | Tutorials and workshops (RE) | Low. Not opened. |
| Build session recording (Sep 3) | https://youtu.be/ws61g53S2b4 | Chris Traganos and Moses Roth walking through all four tracks, including "Using the MCP open standard to build Alexa+ add-ons" (UP) | Worth watching for how Amazon frames Alexa+ MCP. HTTP 200, video not watched. |
| dev.to | https://dev.to/amazonappdev | Technical articles (RE) | Low. Not opened. |
| Newsletter | https://m.amazonappservices.com/hackathon-subscribe | Product updates (RE) | None. Not opened. |
| AWS Builder Center / Learn | https://builder.aws.com/ , https://builder.aws.com/learn | AWS tutorials for Bedrock, AgentCore and Kiro (RE) | AWS Builder mini challenge. Not opened. |
| AWS credit form | https://forms.gle/5hyhr1u6x3fuV2aW7 (RU); FAQ links https://docs.google.com/forms/d/e/1FAIpQLSeBczXNHM9Y1Zy7KoaKRCGdRS4YJQGOcgM6hV8qouAEnHMz4Q/viewform | $150 per person | Closed Oct 7: out of codes (RU, RE). |
| Office Hours #2 | https://amazon.zoom.us/webinar/register/WN_kh9CSYi0QtuN31d8nsTuOQ | Oct 19, 9:00 am PT (UP) | Last live chance to ask Alexa judges questions. |
| Devpost Discord | https://discord.com/invite/devpost | Check in at `#amazon-developer-checkin` for the hackathon space (UP) | Organizers are active there. Not opened. |
| Hacktoberfest | https://hacktoberfest.com/questions/ | Mentioned for the Open Source timing; "We are not affiliated with it" (RE) | Optional. Not opened. |
| Fire TV, Bee and Ring links | listed on RE | Track-specific samples and docs | Not relevant to Alexa+. Not opened. |

## Rules that constrain us

- **No real Alexa+.** The MCP Toolkit, `alexa-ai` CLI, Category SDK, web simulator and AWS add-on role are closed to participants (FQ; FT/45262; FT/45255; FT/45256). The judged surface is our own front end.
- **Spec floor.** MCP 2025-11-25 or later, over Streamable HTTP (RU).
- **Runtime hook.** On the MCP path the repo must import and call the MCP server or config, not only describe it (RU).
- **Everything needed to run must be in the repo.** "The repository must contain all necessary source code, assets, and instructions required for the project to be functional" (RU). If assets can't be open-sourced, the organizer recommends going private: "instead of making it open source, to keep it private and invite the github usernames" (FT/45418-ai-generated-assets-...). A separately hosted proprietary backend is acceptable if judges get credentials and it runs through judging (FT/45420-...).
- **IP.** The Submission must "be your ... original work product", "be solely owned by you", and "not violate the intellectual property rights or other rights including but not limited to copyright, trademark, patent, contract, and/or privacy rights" (RU). Open source is allowed if we comply with its licenses and "create[s] software that enhances and builds upon" it (RU). Ownership stays with us. The Sponsor gets "a non-exclusive license to use such entry for judging", and Sponsor and Devpost may "use the name, likeness, voice and image of all individuals contributing to a Submission" in promotion for three years (RU, section 7).
- **No Alexa+ logo.** "We cannot grant you approval to use the Alexa+ logo." (FT/45450-change-of-type-of-project-and-logo-permission)
- **Third-party content.** "If a Project integrates any third-party SDK, APIs and/or data, Entrant must be authorized to use them" (RU). The video must avoid third-party trademarks and copyrighted music or footage without permission (RU). Licensed or Creative Commons footage: "Properly-attributed, brief supporting or background footage is typically fine - check with us on the specifics" (FQ). Clips ripped from YouTube or Prime are not allowed (FT/45329-media-footage-copyright-issue).
- **Hardware access.** For software on devices "other than smartphones, tablets, or desktop computers", the Sponsor may "require the Entrant to provide physical access to the Project hardware upon request" (RU). This does not apply to a web simulator.
- **Uptime.** "Your MCP server doesn't need to stay running after you submit" (FQ, the newer source). An older forum reply answered "Yes" to "Must the hosted MCP endpoint stay live through judging" (FT/45411-...). The rules require the project to be available "for testing, evaluation and use ... until the Judging Period ends" (RU). Safest plan: a locally runnable repo, plus a hosted endpoint kept up until Nov 20 if we host one.
- **Language.** Everything in English (RU).
- **Multiple submissions.** Allowed, but each must be "unique and substantially different" (RU).
- **Minors, COPPA, test accounts.** The overview, rules, FAQ, updates and the discussion threads read here say nothing about minors, COPPA, children's data or test accounts. The only age rule is that entrants must be adults. The only account rule is that private sites must include login credentials in testing instructions (RU). Privacy rights do fall under the IP warranty (RU, section 7), and post-deadline edits are allowed only to remove material that "discloses personally identifiable information" (RU, section 5).
- **AWS Builder qualifier.** "Kiro Crew qualifies on its own" (RU). Claude Code running on Bedrock also counts: "Yes, CC on Bedrock would count." (FT/45321-...)
- **Costs.** "Additional charges incurred by the Entrant for the use of AWS products are the responsibility of the Entrant" (RU).

## Updates log

All posts at UP were read in full except where noted.

| Posted (relative to 2026-10-08) | Title | Content relevant to Alexa+ |
|---|---|---|
| ~Oct 6 ("2 days ago") | FAQs | Announces the FAQ tab (FQ). |
| ~Oct 5 ("3 days ago") | Strong Submission Tips | Product feedback is required and must name the tool. Hide API keys. Name the track tool in the description, Built With and video. The video is a pitch. "Submissions close Friday, October 23 at 12:00 PM PT." |
| ~Oct 2 ("6 days ago") | Office Hours Schedule | Oct 6, 10:30 am PT; Oct 19, 9:00 am PT, with Zoom links. |
| ~Sep 18 ("20 days ago") | Got an idea? | For Alexa+: "a single turn Q&A bot works, an agentic workflow that orchestrates across services or keeps context across sessions stands out more." Each criterion scored 1 to 5, equally weighted. Repos may now be private, with the six reviewers plus testing@devpost.com. |
| ~Sep 14 ("24 days ago") | Let's get you building! | Alexa+: "build an Agent Skill or a self hosted MCP server on the open MCP standard. No MCP experience? Simulate the Alexa+ experience with any agentic tools you already know." |
| ~Sep 3 | Build Session recording is up | Recording https://youtu.be/ws61g53S2b4 and a list of resource links. Discord `#amazon-developer-checkin`. |
| ~Sep 3 | Starting in 1 hour | Reminder. |
| ~Sep 2 | Tomorrow! Live Build Session | Agenda includes "Using the MCP open standard to build Alexa+ add-ons". |
| ~Sep 1 | Live session Thursday | Announcement. |

Discussions (FT) were public. All titles on both index pages were listed; the threads read in full are the ones cited above (45397, 45058, 45199, 45255, 45256, 45262, 45403, 45411, 45418, 45420, 45430, 45333, 45450, 45321, 45329, 45264, 45310). Bedrock-quota and Ring threads were not opened. The project gallery says "The hackathon managers haven't published this gallery yet" (https://amazonappdev2026.devpost.com/project-gallery). The participants page was not opened.

## Open questions

1. **Judging start date.** The rules say Nov 9 and the schedule page says Oct 26. The rules prevail, but anything hosted should be up from Oct 26. Worth asking at the Oct 19 office hours.
2. **Uptime.** The FAQ ("doesn't need to stay running") and FT/45411 ("Yes") conflict. Does the RU testing clause, "available ... until the Judging Period ends", apply to a hosted endpoint if the repo runs locally?
3. **Public or private repo.** NYC-MON canon, characters and art are proprietary. A public repo needs an OSS license covering "all necessary ... assets", or a split asset license, which the organizer steered away from in FT/45418. Private is the clean path, and the Open Source mini challenge then needs a separate public contribution.
4. **Real people's voices and likeness in the demo.** The rules' IP warranty covers "privacy rights" and "publicity rights" (RU, section 7), and Sponsor may use the "name, likeness, voice and image of all individuals contributing" (RU). Does "James" appear as a real person? If so, get written permission. No rule addresses voice biometrics or minors' data; the pages are silent on COPPA.
5. **"Agent Skill" meaning.** The rules accept "a working Agent Skill or a self-hosted MCP server". The Resources link for Agent Skills goes to the MCP Apps docs, which ship four skills in the agentskills.io format for building MCP Apps (RE). No page defines what a judged "Agent Skill" deliverable looks like beyond that.
6. **MCP Apps rendering.** Judges list MCP Apps as "Creative" (RU), but no page says whether a self-built host rendering MCP App UI counts as showing it. FT/45255's author did that and got no objection.
7. **Third-party marks in the simulator.** Can the simulator say "Alexa" (wake word, labels) without the logo? FT/45450 bars only the logo. The video rule bars "third party trademarks" without permission, but the track itself is named Alexa+. Ask at office hours.
