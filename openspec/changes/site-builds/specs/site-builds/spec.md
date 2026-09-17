## ADDED Requirements

### Requirement: One site with the live app, previews and a listing
The published site SHALL hold the app as it is on `main` at the root, a preview of every open pull request from a branch of this repository under `pr/<number>/`, and a listing at `builds/`. The live app's address, files and offline behaviour SHALL NOT change because previews exist, except for one marker tag in its page saying where the listing is. Development files (tests, specs, scripts, workflow files, the lock file) SHALL NOT be published in any tree.

#### Scenario: Site with one open pull request
- **WHEN** the site is built while pull request 1 is open
- **THEN** the root serves main's app, `pr/1/` serves the pull request's app, and `builds/` lists both

#### Scenario: Installed app is unaffected
- **WHEN** someone who installed the app from the root opens it after previews were added
- **THEN** it opens at the same address with the same saved songs and the same offline cache

### Requirement: Listing
The listing SHALL show main first, with its version, commit and links to open the app, the guide and the history, then every open pull request, newest first. Each pull request SHALL show its number, its title, whether it is a draft, its review state and labels when it has them, its author, branches, size and last update, what the change is for, a link to view its build and a link to the pull request. With no open pull requests the listing SHALL say so and how a preview appears. The listing SHALL say when it was built and link to the run that built it.

#### Scenario: Reviewer opens the listing
- **WHEN** a reviewer opens `builds/` while a pull request titled "Format 4" is open
- **THEN** they read what the change is for, and one link opens its build and another opens the pull request

#### Scenario: Nothing open
- **WHEN** no pull request is open
- **THEN** the listing shows main and says that an opened pull request appears within a couple of minutes

### Requirement: Purpose summary
What a change is for SHALL be taken from the pull request's description: the text under a heading named what, why, summary, purpose, overview, description or motivation when there is one, otherwise the opening paragraphs. Comments, images and generated-by lines SHALL be dropped, a list SHALL keep at most six items and count the rest, and the whole SHALL be clipped to a short passage. Titles and descriptions SHALL be treated as untrusted text: escaped everywhere, with only bold, code and http(s) links rendered.

#### Scenario: Description with a Why section
- **WHEN** a description has a checklist, then "## Why" followed by two paragraphs
- **THEN** the listing shows the two paragraphs

#### Scenario: Empty description
- **WHEN** a pull request has no description
- **THEN** the listing says there is no description yet and still links to the build and the pull request

#### Scenario: Hostile title
- **WHEN** a title contains `</script><script>alert(1)</script>`
- **THEN** it appears as text in the listing and in the preview's bar and no script runs

### Requirement: Previews follow their pull requests
A preview SHALL appear when a pull request is opened or reopened, SHALL be rebuilt on every push to it, and SHALL leave the site when it is closed or merged. The listing SHALL follow edits to a title, a description or the draft state. Every build SHALL produce the whole site from main and the pull requests open at that moment, and builds SHALL deploy one at a time.

#### Scenario: Push to an open pull request
- **WHEN** a commit is pushed to a pull request's branch
- **THEN** within a couple of minutes `pr/<number>/` serves that commit and the listing shows its short hash

#### Scenario: Pull request merged
- **WHEN** a pull request is merged
- **THEN** the next build has no `pr/<number>/` and the root serves the merged app

### Requirement: Previews are fenced from the live app
A preview runs on the live app's origin, so the build SHALL make it keep every localStorage key under a `pr<number>:` prefix, SHALL prevent it from registering a service worker and replace its service worker file with one that unregisters itself and touches no cache, SHALL mark it `noindex`, SHALL prefix its title with the pull request number, and SHALL put a bar at the top naming the pull request with links to the pull request and to the listing. The bar SHALL fit one line on a phone, SHALL NOT make the page scroll, and SHALL be dismissable. These changes SHALL be made by the build and SHALL NOT require anything of the pull request.

#### Scenario: Saved songs stay apart
- **WHEN** a song is edited in the preview of pull request 7
- **THEN** it is saved under `pr7:tutti.songs.v1`, and the live app's `tutti.songs.v1` is unchanged

#### Scenario: A preview of a different file format
- **WHEN** a preview whose app refuses the live app's saved songs is opened and used
- **THEN** the live app's saved songs are still there afterwards

#### Scenario: Reload after a push
- **WHEN** a preview is reloaded after a new commit was deployed
- **THEN** the new commit's app loads, because nothing was cached offline

### Requirement: Shared samples
When a pull request's `banks/` is identical to main's, its preview SHALL be published without `banks/` and SHALL load samples from the live site. A pull request that changes `banks/` SHALL get its own copy.

#### Scenario: Code-only pull request
- **WHEN** a pull request changes only source files
- **THEN** its preview is about a megabyte and the flute plays from the live site's samples

### Requirement: Nothing from a pull request is executed
The workflow SHALL run from `main` for pull request events, with read-only access to contents and pull requests plus what Pages deployment needs, and SHALL only copy a pull request's files into the site: nothing from a pull request SHALL be installed, built or run. A pull request from a fork SHALL be listed without a preview, with the reason. A pull request whose preview cannot be built SHALL be listed with the reason, and main and the other previews SHALL still deploy.

#### Scenario: Pull request edits the workflow
- **WHEN** a pull request changes the Pages workflow or the build script
- **THEN** the site is still built by main's versions of both

#### Scenario: Fork
- **WHEN** a pull request comes from a fork
- **THEN** the listing shows it with a link to the pull request and says why it has no preview

#### Scenario: Broken branch
- **WHEN** a pull request's branch has no `index.html`
- **THEN** that pull request is listed without a preview and everything else deploys

### Requirement: Footer link to the listing
The live app's footer SHALL link to the listing with the number of previews when its page carries the build's marker, and SHALL show no link and make no request for it when it does not: running locally, in tests, or inside a preview, where the bar has the link.

#### Scenario: Live site
- **WHEN** the live app is opened while one preview exists
- **THEN** the footer shows "builds · 1 preview ↗" linking to `builds/`

#### Scenario: Local server
- **WHEN** the repository is served locally
- **THEN** the footer shows no builds link and the console has no failed request

### Requirement: Builds data file
The build SHALL write `builds/builds.json` with when it was built, main's commit, date, subject and version, and for every open pull request its number, title, address, branch, commit, draft state, the path of its preview or null, and whether it shares main's samples.

#### Scenario: Script reads the builds
- **WHEN** a script fetches `builds/builds.json` while pull request 1 has a preview
- **THEN** it finds `pulls[0].preview` equal to `pr/1/`
