# Content Blocker

**Mark Cockerill**
**ID: 2025825**
**AC40001 Honours Project**
**BSc (Hons) Computing Science**
**University of Dundee, 2026**
**Supervisor: Craig Ramsay**

---

## Abstract

This project presents the design and implementation of a multi-platform content blocking and privacy protection suite. The system addresses the growing threats of the modern web — intrusive advertising, pervasive user tracking, malvertising, and degraded content quality — through a unified architecture spanning a Chrome browser extension, an Electron desktop application, and a mobile interface. Unlike existing tools that operate at a single level, this solution combines browser-level ad blocking via the Manifest V3 declarativeNetRequest API, system-level DNS filtering through AdGuard DNS integration, and a novel granular content sanitiser that allows users to filter specific topics at the word, paragraph, or page level rather than blocking entire URLs. The system also incorporates a heuristic-based cyber security scanner for real-time threat detection, an in-page translation proxy, and YouTube-specific ad mitigation. Evaluation through unit testing demonstrates the reliability of core modules, while the multi-layered blocking strategy provides measurably improved bandwidth savings and browsing speed. The project concludes that a layered, user-centric approach to content control can restore meaningful agency to users navigating an increasingly hostile web.

---

## Introduction

The modern web has evolved dramatically from its origins as a decentralised information utility. Since Ethan Zuckerman wrote the code for the first pop-up advertisement in the mid-1990s, the implicit contract of the internet — free content in exchange for attention — has become increasingly hostile to end users. Today, users are subjected to aggressive data harvesting, intrusive tracking scripts, and "malvertising" vectors that can compromise device security through nothing more than loading a webpage.

Beyond privacy concerns, the very quality of information available online has deteriorated. The concept once known as the "Dead Internet Theory" — proposing that a significant proportion of web traffic is now bot-generated — has moved from speculation to documented reality. Automated content systems are designed to maximise engagement through polarisation and provocative material, often referred to as "rage-bait." Users navigating this landscape lack the tools to exercise nuanced control. Existing ad-blocking solutions, while effective at their specific scope, operate with a binary approach: they block or allow entire domains and URLs. They do not provide the granularity to filter specific topics within a page. A user cannot, for instance, choose to read a news site while hiding all content related to spoilers, political commentary, or graphic violence.

This project aims to address these limitations by creating a unified content blocking and privacy protection suite that operates across three platforms: a Chrome browser extension for direct web interaction, an Electron desktop application for system-wide DNS-level protection, and a mobile application for on-the-go privacy management. The objectives of the project are:

1. To implement multi-layered ad and tracker blocking that operates at both the network request level and the DOM element level, providing comprehensive protection against advertising and tracking.
2. To design and build a granular content sanitisation system that allows users to define topic-based filters with configurable scope (word, paragraph, or entire page warning), moving beyond the URL-level blocking of existing tools.
3. To develop a heuristic-based security scanning engine capable of identifying phishing, malware distribution, and suspicious URLs in real time without reliance on external paid APIs.
4. To integrate system-level DNS modification for desktop-wide ad blocking, providing protection that extends beyond a single browser.
5. To create a cohesive, themeable user interface across all platforms that maintains a consistent experience while adapting appropriately to each platform's strengths.
6. To lay the groundwork for VPN integration, providing encrypted traffic routing through a self-hosted infrastructure.

The result is a system that gives users genuine agency over what they see, what tracks them, and how their data flows — all within a polished, accessible interface.

---

## Background

The landscape of content blocking and privacy tools has matured significantly since the early days of simple pop-up blockers. This section examines the existing solutions, the academic and technical context surrounding them, and the gap that this project addresses.

### Existing Ad-Blocking Solutions

**uBlock Origin** remains the most widely used browser-based ad blocker, relying on comprehensive filter lists such as EasyList and EasyPrivacy. It operates through a combination of network request interception and cosmetic (element-hiding) filtering. Its strength lies in its efficiency and community-maintained filter lists, but it is confined to the browser and offers no system-level protection. The transition to Chrome's Manifest V3 has also constrained its capabilities, as the deprecation of the blocking webRequest API limits real-time request interception.

**AdGuard** offers a broader ecosystem, providing both a browser extension and a DNS-based filtering service. AdGuard DNS (using servers such as 94.140.14.14 and 94.140.15.15) blocks ads and trackers at the DNS resolution level, meaning protection extends to all applications on a device rather than just a single browser. However, AdGuard's DNS approach is inherently coarse-grained — it blocks or allows entire domains, and cannot distinguish between ad-serving and legitimate content on the same domain.

**Pi-hole** takes the DNS-based approach further by running as a dedicated network appliance, typically on a Raspberry Pi. It functions as a DNS sinkhole, blocking ad-serving domains for all devices on a local network. While powerful, it requires dedicated hardware, network configuration knowledge, and does not provide any content-level filtering.

### VPN and Privacy Services

**NordVPN, ProtonVPN, and AtlasVPN** represent the commercial VPN market, providing encrypted tunnels for traffic routing. These services typically focus on encrypting traffic and masking IP addresses, with some offering built-in ad-blocking features (such as NordVPN's "Threat Protection"). Their user interfaces, characterised by dark themes, world maps for server selection, and prominent connection status indicators, have established design conventions that users of privacy tools now expect. However, VPN services do not address content quality or provide granular filtering, and commercial offerings raise questions about trust, given that the VPN provider itself can observe all traffic.

### Content Filtering and Moderation

Traditional content filtering approaches, such as parental control software, operate primarily through URL blocklists and keyword matching at the network level. These tools are designed for restrictive filtering rather than nuanced user preference. Academic work in natural language processing and content classification has explored topic-based filtering, but practical implementations available to end users remain limited. The concept of allowing a user to specify "block content about violence, unless it appears in the context of a peace treaty" represents a departure from existing tooling that this project explores through its Smart Filters feature.

### The Manifest V3 Transition

Google's transition of the Chrome extension platform from Manifest V2 to Manifest V3 represents a significant technical constraint for ad-blocking extensions. The removal of the blocking variant of the webRequest API — previously the foundation of extensions like uBlock Origin — in favour of the declarativeNetRequest API has required fundamental rearchitecting of ad-blocking approaches. The declarativeNetRequest API requires rules to be declared in advance rather than evaluated at runtime, limiting the dynamic flexibility that content blockers previously relied upon. This project was designed from the outset to work within the Manifest V3 framework, using declarativeNetRequest for network-level blocking while supplementing it with content-script-based element hiding and DOM manipulation.

### Gap Analysis

The review of existing tools reveals a consistent pattern: each tool addresses a single dimension of the problem. Browser extensions block ads within the browser. DNS services block domains system-wide. VPNs encrypt traffic. Content filters block URLs. No existing solution combines all of these capabilities with the additional dimension of granular, topic-based content filtering within pages. This project seeks to fill that gap by providing a unified, multi-platform solution that operates at multiple layers simultaneously.

---

## Specification

### Functional Requirements

The following requirements were identified through analysis of existing tools, user expectations, and the project objectives:

1. **Multi-Layer Ad Blocking**: The system shall block advertisements using both network request interception (via declarativeNetRequest) and DOM element hiding (via CSS injection and MutationObserver). These two layers shall operate independently so that if one fails, the other continues to provide protection.
2. **YouTube-Specific Ad Mitigation**: The system shall provide specialised handling for YouTube advertisements, including auto-skipping pre-roll ads, hiding overlay advertisements, and accelerating unskippable ads.
3. **Granular Content Filtering**: Users shall be able to define custom filter rules specifying a term to block, an optional exception context, and a scope (word-level, paragraph-level, or full page warning).
4. **Multiple Censorship Methods**: The content filtering system shall support multiple presentation modes for filtered content: blur, black-bar redaction, warning labels, and humorous replacement (kittens).
5. **Security Scanning**: The system shall provide heuristic-based URL scanning capable of detecting phishing domains, malware distribution, tracker domains, and suspicious URLs through multi-factor analysis.
6. **In-Page Translation**: The system shall provide translation of web page content, proxied through a background script to avoid CORS restrictions and protect user privacy.
7. **System-Level DNS Protection**: The desktop application shall modify system DNS settings to route traffic through AdGuard DNS, providing ad blocking for all applications, and shall modify the system hosts file for additional domain blocking.
8. **Safe DNS Restoration**: The desktop application shall persist original DNS settings, restore them on exit, and provide an emergency reset mechanism.
9. **VPN Integration (Foundation)**: The system shall include foundational VPN infrastructure (server list, connection UI, backend status endpoint) with full implementation as future work.
10. **Multi-Theme Support**: All platforms shall support at least four visual themes (Dark, Light, Vaporwave, Frutiger Aero).
11. **Cross-Platform Consistency**: Shared UI components shall be used across the extension, desktop, and mobile platforms to ensure consistent behaviour and appearance.

### Non-Functional Requirements

1. The extension shall comply with Chrome Manifest V3 requirements.
2. The system shall operate without paid API dependencies for core functionality.
3. The desktop application shall require administrator privileges only for DNS modification operations.
4. The system shall persist user preferences and statistics across sessions.

### User Stories

- As a user, I want to block all ads on YouTube so that I can watch videos without interruptions.
- As a user, I want to filter out content about a specific topic from a webpage without leaving the page entirely.
- As a user, I want to know if a link on a page I am visiting is potentially dangerous before I click it.
- As a user, I want system-wide ad blocking that protects all applications on my computer, not just my browser.
- As a user, I want to quickly see how much bandwidth and time the blocker has saved me.

---

## Design

### Architecture Overview

The system follows a monorepo architecture, with all platform-specific applications and shared packages coexisting in a single repository. This approach was chosen for several reasons: it eliminates version synchronisation issues between shared code and platform-specific code, it simplifies dependency management, and it enables rapid iteration across all platforms simultaneously.

The architecture is structured into four layers:

1. **Shared Packages** (`packages/`): Core business logic (`packages/core`), configuration constants (`packages/config`), and reusable UI components (`packages/ui`). These packages define the fundamental types, adblock rule parsing, VPN server configurations, theme system, and shared components such as the ActivationButton, ProtectionToggles, and TrackerCard.
2. **Platform Applications** (`apps/`): The extension, desktop, and mobile applications, each importing from the shared packages but implementing platform-specific behaviour.
3. **Infrastructure** (`electron/`): The Electron main process, handling system-level operations (DNS modification, hosts file management, IPC communication).
4. **Backend** (`apps/backend/`): An Express server providing a privacy-preserving translation proxy and VPN status endpoints.

### Technology Choices

**Next.js** was selected as the primary web framework for several reasons. It provides server-side rendering capability, an excellent development experience with hot reloading, and a natural routing structure. The choice to use Next.js for the extension UI (rather than a dedicated extension framework) was deliberate: it enables development and testing of the extension interface in a standard browser tab during development, with the same code deployed as the extension popup in production. A custom Chrome Bridge module was developed to abstract the difference between running in a browser tab (dev mode) and running as an actual Chrome extension popup.

**Electron** was chosen for the desktop application because it allows the same React-based UI to be displayed in a native window while providing access to system-level operations through its main process. The Electron main process handles privileged operations such as DNS modification and hosts file management that cannot be performed from a web context.

**React 19** with **TypeScript** provides the component model and type safety throughout the project. TypeScript was essential for a project of this scale, particularly in ensuring correct message passing between the content script, background script, and popup contexts of the Chrome extension.

**Tailwind CSS v4** was chosen for styling due to its utility-first approach, which accelerates UI development and ensures consistent spacing, typography, and colour usage. The theme system was built on top of Tailwind's class composition, with each theme defined as a mapping of semantic colour names to Tailwind utility classes.

**anime.js** was selected for animation because of its lightweight footprint and its ability to animate CSS properties, SVG attributes, and DOM attributes. It provides the fluid transitions and micro-interactions that distinguish a polished privacy tool from a merely functional one — an important consideration given the project's aim to match the design quality of commercial VPN applications.

**Vitest** was chosen over Jest for testing because it integrates natively with the existing Vite-based build toolchain, provides significantly faster test execution through its use of native ES modules, and shares configuration with the development build.

### Ad-Blocking Design

The ad-blocking architecture employs three independent layers, each capable of operating if the others fail:

1. **declarativeNetRequest (DNR)**: The primary blocking layer. Ad-serving domains and YouTube-specific URL patterns are compiled into DNR rules that Chrome's network stack evaluates before requests are made. This approach is fully Manifest V3 compliant and operates at near-zero performance cost because the evaluation happens in Chrome's C++ networking layer, not in JavaScript.
2. **Element Hiding**: A content script injects CSS selectors targeting known ad containers, hiding them from the rendered page. A MutationObserver monitors for dynamically inserted ad elements and hides them in real time.
3. **YouTube Ad Mitigation**: A specialised module detects YouTube video ads through DOM observation, automatically clicks skip buttons, fast-forwards unskippable ads at 16x speed with audio muted, and removes overlay advertisements.

### Content Filtering Design

The Smart Filters system represents the project's most novel contribution. Rather than filtering at the network level, it operates at the DOM text-node level. A TreeWalker traverses the page's text nodes, comparing each against the user's filter rules. When a match is found, the system checks the exception context and, if the filter should apply, modifies the display according to the chosen scope:

- **Word scope**: Only the matched term is affected, replaced with a styled span, while surrounding text remains visible.
- **Paragraph scope**: The entire containing block element (paragraph, list item, or div) is filtered.
- **Page warning scope**: A full-page overlay warns the user that the page contains matching content, offering options to proceed or go back.

This granularity is not available in any existing ad blocker or content filter.

### Security Scanner Design

The security scanner uses a multi-factor heuristic approach rather than relying on external API calls (which would introduce latency, cost, and privacy concerns). The scanner evaluates URLs across twelve risk factors including hostname structure, keyword analysis, brand impersonation detection, TLD reputation, URL obfuscation techniques, and homograph attack indicators. Each factor contributes to a composite risk score, with configurable thresholds for "suspicious" and "dangerous" classifications. A local threat database of known phishing domains, malware file extensions, and URL shorteners provides an additional detection layer.

### System-Level DNS Design

The desktop application's DNS modification operates through PowerShell commands executed from the Electron main process. When protection is activated, the system captures the current DNS configuration for all active network adapters, saves this as a backup (persisted to disk for crash recovery), and sets AdGuard DNS servers as the system DNS. Simultaneously, the system hosts file is updated with a blocklist fetched from the StevenBlack consolidated hosts repository. When protection is deactivated or the application exits, the original DNS settings are restored and the hosts file entries are removed. An emergency reset mechanism provides a safety net for unexpected failures.

---

## Implementation and Testing

### Multi-Layer Ad Blocking Implementation

The ad-blocking engine is implemented across two primary modules. The `adBlockEngine.ts` module defines the comprehensive filter lists — over 50 ad-serving and tracking domains spanning Google Ads, Facebook/Meta, Amazon, and major ad networks — and provides the `generateDNRRules()` function that compiles these into Chrome's declarativeNetRequest rule format. Each rule specifies a URL pattern, resource types to match, and a blocking action.

The `background.ts` service worker initialises these rules on extension installation, setting them up in batches of 1,000 to respect Chrome's dynamic rule limits. It also registers a non-blocking webRequest observer for statistics tracking — recording how many requests would have been blocked, categorised by type (ads, trackers, analytics, social, YouTube). This observer is deliberately non-blocking and fully MV3 compliant, using webRequest only for observation while declarativeNetRequest handles the actual blocking.

The content script (`content.ts`) provides the element-hiding layer. On page load, it queries the DOM for elements matching a comprehensive list of CSS selectors targeting common ad container patterns. A MutationObserver continues this process for dynamically loaded content, ensuring that ads injected after the initial page render are also hidden.

### YouTube Ad Blocking Implementation

YouTube's ad delivery has become increasingly sophisticated, requiring dedicated countermeasures. The `youtubeAdBlocker.ts` module implements five parallel methods:

1. CSS injection hiding all known YouTube ad element classes.
2. A DOM MutationObserver that removes ad elements as YouTube injects them.
3. An auto-skip routine that checks every 500ms for the presence of skip buttons and clicks them programmatically.
4. Overlay removal running at 1-second intervals.
5. Ad speed control that detects video ads and sets playback rate to 16x with audio muted.

### Content Sanitiser Implementation

The Smart Filters system processes user-defined filter rules through a two-phase approach:

**Phase 1 (Scan)**: A `TreeWalker` traverses all text nodes in the document body, checking each against the active filter rules. Nodes matching a filter's `blockTerm` are collected, along with their exception context. Script and style tags are excluded from traversal to avoid corrupting page functionality.

**Phase 2 (Mutation)**: Collected nodes are processed according to their filter's scope. Word-scope filtering uses regex-based splitting to isolate and replace only the matched term within its text node, preserving all surrounding content. Paragraph-scope filtering walks up the DOM tree to find the nearest block-level parent and applies the censorship method to the entire element. Page-warning scope creates a full-screen overlay with event-driven proceed/go-back buttons.

All censorship methods support click-to-reveal, allowing users to selectively uncover filtered content. This was an intentional design choice: the system empowers users to make informed choices about what they see, rather than imposing absolute restrictions.

### Security Scanner Implementation

The `security.ts` module implements a twelve-factor heuristic scoring system. Each URL is analysed for excessive subdomains, unusual hostname length, suspicious keywords, brand name impersonation on unofficial domains, known malicious TLDs, URL obfuscation via @ symbols, bare IP addresses, missing HTTPS, excessive URL length, parameter stuffing, heavy URL encoding, and Punycode/homograph attack indicators. The composite score is capped at 10, with thresholds at 3 (suspicious) and 6 (dangerous).

The scanner also maintains a local database of known phishing domains, dangerous file extensions, URL shorteners, and tracker domains for deterministic matching before heuristic analysis.

### Desktop System Protection Implementation

The Electron main process (`electron/main.js`) implements system-level protection through IPC handlers. The `adblock:enable` handler executes a seven-step process: checking admin privileges, capturing the current public IP, enumerating active network adapters via PowerShell, backing up current DNS settings (persisted to disk), updating the hosts file with a dynamically fetched blocklist from StevenBlack's repository, applying AdGuard DNS to all adapters, and flushing DNS caches.

A critical safety feature is the `before-quit` event handler, which intercepts application closure and restores all DNS settings before allowing the process to exit. This prevents the scenario where a user could be left with modified DNS settings after closing the application.

### Chrome Bridge Implementation

The `chromeBridge.ts` module abstracts the communication differences between three execution contexts: running as a Chrome extension popup (direct API access), running in an iframe within the extension (postMessage to parent), and running on localhost in development mode (external messaging via `chrome.runtime.sendMessage` with the extension ID). This abstraction was essential for enabling development-time testing of all extension features in a standard browser tab.

### Testing

The project employs Vitest with a jsdom test environment. A setup file provides comprehensive mocks of Chrome APIs (`chrome.storage.local`, `chrome.runtime`, `chrome.tabs`), enabling extension-specific code to be tested in a Node.js environment without a browser. The existing test suite covers the ad-blocking engine (domain classification, statistics tracking, stats reset), the security scanner (phishing detection, malware detection, tracker identification, heuristic analysis, edge cases), the Chrome Bridge (API availability detection, tab querying, message sending), and the content filter (word-scope filtering, paragraph-scope filtering, exception rules, filter cleanup).

---

## Evaluation / Testing

### Testing Methodology

The system was evaluated through automated unit testing covering the core logic modules. The Vitest test framework was used with a jsdom environment to simulate browser APIs, and a custom setup file provides mocks for Chrome-specific APIs that are unavailable outside a browser extension context.

### Test Coverage

The automated test suite covers four primary modules:

| Module        | Tests | Coverage Focus                                                |
| ------------- | ----- | ------------------------------------------------------------- |
| adBlockEngine | 7     | Domain classification, stats tracking, stat reset             |
| security      | 7     | Phishing detection, malware, trackers, heuristics, edge cases |
| chromeBridge  | 5     | API detection, tab queries, message routing                   |
| content       | 4     | Word/paragraph scope, exception rules, cleanup                |

### Key Results

All tests execute within approximately 2 seconds on a standard development machine, demonstrating the efficiency of the Vitest test runner. The security scanner's heuristic analysis correctly identifies multi-factor threats (e.g., a URL combining brand impersonation, suspicious TLD, and missing HTTPS) with appropriately elevated risk scores. The content filter accurately respects exception rules, correctly excluding content that matches both a block term and its exception context.

### Metrics

The ad-blocking statistics system provides quantitative measurements:

- **Total requests blocked**: Counted per session, categorised by type.
- **Bandwidth saved**: Estimated using average payload sizes per resource type (50KB for images, 75KB for scripts, 2MB for video ads).
- **Time saved**: Calculated against a 10 Mbps connection baseline.
- **Money saved**: Estimated against UK mobile data costs (approximately £5 per GB).

### Limitations

The evaluation is primarily automated; comprehensive user testing with real end users would provide valuable feedback on the content filtering interface and the perceived effectiveness of the multi-layer blocking approach. The heuristic security scanner, while effective for common patterns, cannot match the detection rates of services backed by large-scale threat intelligence databases. The system's effectiveness against YouTube ads is subject to YouTube's frequent updates to their ad delivery mechanisms.

---

## Description of the Final Product

The final product consists of three interconnected platform applications sharing a common codebase.

### Browser Extension

The Chrome extension provides the primary web browsing protection layer. Its popup interface displays the current protection status through a prominent shield-based activation button, with toggles for ad blocking and VPN. Below the activation controls, a statistics card shows real-time counts of blocked requests, bandwidth saved, time saved, and estimated money saved. The Cyber Scanner section displays the security assessment of the current page and provides a full-page link scanner that analyses all hyperlinks for threats. The Content Sanitiser allows users to define and manage custom topic filters with configurable scope and censorship method. A built-in translator provides in-page translation of web content.

### Desktop Application

The Electron-based desktop application provides a dashboard-style interface focused on system-level protection. The main panel features a large activation button with a "SECURED" / "PAUSED" status indicator and explanatory text. System toggles control both the DNS-level ad blocking and the placeholder VPN tunnel. A Connection Integrity panel displays the current DNS protocol and resolver status. A test button allows users to verify that ad blocking is actively functioning by performing a DNS lookup against a known ad domain. The footer displays real-time information about the active network adapter and DNS node.

### Mobile Application

The mobile interface provides a three-tab layout: Shield (main protection toggle with status and toggles), VPN (server selection with an interactive world map showing server locations, ping times, and load percentages), and Stats (detailed blocking statistics and protection status breakdown).

### Themes

All three platforms support four visual themes — Dark (emerald-accented cybersecurity aesthetic), Light (clean blue-accented professional look), Vaporwave (pink and cyan retro-futuristic), and Frutiger Aero (sky-blue and emerald glassmorphic) — providing visual personalisation while maintaining consistent functionality.

---

## Appraisal

Reflecting on the project, several decisions proved particularly effective while others highlighted areas for improvement.

### What Worked Well

The monorepo architecture with shared packages was one of the strongest decisions. Having shared types, theme configurations, and UI components in `packages/ui` meant that changes to core functionality automatically propagated to all platforms. The `ThemeProvider` context, defined once, provides consistent theming across the extension, desktop, and mobile interfaces without any platform-specific adaptation.

The Chrome Bridge abstraction was critical. Without it, development of the extension features would have required constant reloading of the Chrome extension. By abstracting the communication layer, the majority of development and testing could occur in a standard browser tab with hot reloading, dramatically accelerating iteration speed.

The choice to design for Manifest V3 from the outset, rather than building for V2 and later migrating, avoided significant rework. The declarativeNetRequest approach, while more constrained than the blocking webRequest API, proved reliable and performant.

### What Could Be Improved

The mobile application, while functional as a web view, would benefit from a native implementation using React Native. The current approach renders web content and simulates mobile interactions, but a genuine native application would provide better performance, native navigation patterns, and access to platform-specific APIs for features like system-wide VPN configuration.

The VPN integration remains foundational rather than complete. While the backend infrastructure (Express server with WireGuard/Dante status endpoints) and the client-side UI (server selection, connection toggles) are in place, the actual tunnel establishment requires further work on the AWS EC2 infrastructure.

The content filter's exception handling is currently limited to simple substring matching within the immediate paragraph context. A more sophisticated approach using natural language processing could better understand the semantic context of filter terms, reducing false positives.

### Lessons Learned

The most significant lesson was the importance of separation of concerns in the Chrome extension architecture. Keeping the content script, background service worker, and popup UI as independent modules communicating through well-defined message passing made the system both more testable and more robust. When one component encountered an error, others continued functioning.

Another key lesson was the value of defensive programming in system-level operations. The DNS modification code includes multiple layers of safety: persisted backups, crash recovery on startup, adapter-level verification, and an emergency reset mechanism. This depth of safety was not in the original design but was added after early testing revealed scenarios where application crashes could leave the system DNS in a modified state.

---

## Summary and Conclusions

This project has delivered a multi-platform content blocking and privacy protection suite that addresses multiple dimensions of the modern web's challenges. The system provides multi-layered ad blocking (network-level, element-level, and YouTube-specific), granular topic-based content filtering with configurable scope and presentation, heuristic-based security scanning, privacy-preserving translation, and system-level DNS protection through an Electron desktop application.

The key technical contributions are the Smart Filters content sanitisation system, which provides word-level, paragraph-level, and page-level content filtering not found in existing tools; the multi-layer ad-blocking architecture designed for Manifest V3 compliance; and the Chrome Bridge abstraction that enables seamless development across extension and web contexts.

The system has been validated through automated unit testing covering the core modules, demonstrating correct behaviour across ad domain classification, security threat detection, content filtering logic, and cross-context communication.

### Future Work

Several directions for future development have been identified:

1. **VPN Completion**: Establishing the WireGuard tunnel between client applications and the AWS EC2 instance, implementing the SOCKS5 proxy integration for the browser extension, and adding connection quality monitoring.
2. **React Native Mobile App**: Porting the mobile interface from React DOM to React Native to provide a genuine native experience with access to system-level network APIs.
3. **Machine Learning Content Classification**: Replacing the current keyword-based content filtering with a local ML model capable of understanding semantic context, reducing false positives and enabling more nuanced topic detection.
4. **User Evaluation**: Conducting structured user testing with diverse participants to evaluate usability, perceived effectiveness, and the utility of the granular content filtering features.
5. **Filter List Subscription**: Allowing users to subscribe to community-maintained filter lists for the content sanitiser, similar to how ad blockers like uBlock Origin support community filter lists.
6. **Cross-Browser Support**: Extending the extension to support Firefox and other Chromium-based browsers.

---

## Acknowledgments

I would like to thank my supervisor, Craig Ramsay, for guidance throughout this project. The ad-blocking filter lists used in this project are derived from the EasyList community and the StevenBlack consolidated hosts file repository.

---

## References

[1] Zuckerman, E. "The Internet's Original Sin." _The Atlantic_, 14 August 2014.

[2] Pujol, E., Hohlfeld, O., and Feldmann, A. "Annoyed Users: Ads and Ad-Block Usage in the Wild." _Proceedings of the 2015 Internet Measurement Conference (IMC)_, ACM, 2015, pp. 93–106.

[3] Englehardt, S. and Narayanan, A. "Online Tracking: A 1-million-site Measurement and Analysis." _Proceedings of the 2016 ACM SIGSAC Conference on Computer and Communications Security (CCS)_, 2016, pp. 1388–1401.

[4] StevenBlack. "Unified hosts file with base extensions." GitHub Repository. Available: https://github.com/StevenBlack/hosts

[5] AdGuard. "AdGuard DNS." Available: https://adguard-dns.io

[6] Google. "Manifest V3 Migration Guide." Chrome Developer Documentation, 2023. Available: https://developer.chrome.com/docs/extensions/develop/migrate

[7] Google. "declarativeNetRequest API." Chrome Developer Documentation, 2023.

[8] NordVPN. "NordVPN — Online VPN Service for Speed and Security." Available: https://nordvpn.com

[9] Proton AG. "ProtonVPN: Secure and Free VPN service for protecting your privacy." Available: https://protonvpn.com

[10] Raymond Hill. "uBlock Origin." GitHub Repository. Available: https://github.com/gorhill/uBlock

---

## Appendices

The following appendices accompany this report (submitted separately):

- **Appendix A**: Full source code repository (GitHub).
- **Appendix B**: Unit test results and coverage report.
- **Appendix C**: Screenshots of the extension, desktop, and mobile interfaces across all themes.
- **Appendix D**: Ad domain filter lists and CSS selector lists used by the ad-blocking engine.
- **Appendix E**: Security scanner heuristic scoring rubric.
