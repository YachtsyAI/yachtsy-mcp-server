import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { Archiver } from "./Archiver.js";
import { HttpUrlProbe } from "./HttpUrlProbe.js";
import { OpenAITarget } from "./OpenAITarget.js";
import type { PackageView } from "./PackageView.js";
import type { Profile } from "./Profile.js";
import { ProfileLoader } from "./ProfileLoader.js";
import type { RuleContext } from "./rules/Rule.js";
import type { Target } from "./Target.js";
import type { Finding } from "./types.js";
import { Validator } from "./Validator.js";

export interface CliOutput {
  log(line: string): void;
  error(line: string): void;
}

export interface CliOptions {
  readonly root: string;
  readonly outDir?: string;
  readonly output?: CliOutput;
  readonly target?: Target;
  readonly validator?: Validator;
}

export interface BuiltPackage {
  readonly profile: string;
  readonly archive: string;
  readonly sha256: string;
}

interface ParsedArgs {
  readonly command: string;
  readonly profile: string;
  readonly online: boolean;
}

/**
 * `build --profile <p|all>`     validate, then write out/<p>/<target>/ and out/<zip>
 * `validate [--online] --profile <p|all>`  validate only
 *
 * Exit code 0 when every selected profile has zero errors, 1 otherwise,
 * 2 for usage errors.
 */
export class Cli {
  private readonly loader: ProfileLoader;
  private readonly outDir: string;
  private readonly output: CliOutput;
  private readonly target: Target;
  private readonly validator: Validator;
  private readonly archiver = new Archiver();

  constructor(options: CliOptions) {
    this.loader = new ProfileLoader(options.root);
    this.outDir = options.outDir ?? join(options.root, "out");
    this.output = options.output ?? { log: (line) => console.log(line), error: (line) => console.error(line) };
    this.target = options.target ?? new OpenAITarget();
    this.validator = options.validator ?? Validator.standard();
  }

  async run(argv: readonly string[]): Promise<number> {
    let args: ParsedArgs;
    try {
      args = Cli.parse(argv);
    } catch (error) {
      this.output.error(error instanceof Error ? error.message : String(error));
      this.output.error(Cli.USAGE);
      return 2;
    }
    if (args.command === "help") {
      this.output.log(Cli.USAGE);
      return 0;
    }
    let names: string[];
    try {
      names = this.loader.resolveNames(args.profile);
    } catch (error) {
      this.output.error(error instanceof Error ? error.message : String(error));
      return 2;
    }

    const context: RuleContext = args.online ? { urlProbe: new HttpUrlProbe() } : {};
    let failed = false;
    const built: BuiltPackage[] = [];
    for (const name of names) {
      const result = await this.process(name, args.command === "build", context);
      if (result === null) failed = true;
      else if (result !== "validated") built.push(result);
    }
    if (built.length > 0 && args.profile === "all" && !failed) {
      const sums = built.map((entry) => `${entry.sha256}  ${entry.archive}`).sort().join("\n");
      writeFileSync(join(this.outDir, "SHA256SUMS.txt"), `${sums}\n`);
      this.output.log(`wrote ${this.display(join(this.outDir, "SHA256SUMS.txt"))}`);
    }
    return failed ? 1 : 0;
  }

  /** Builds and validates one profile. `null` when it has errors. */
  async process(name: string, write: boolean, context: RuleContext = {}): Promise<BuiltPackage | "validated" | null> {
    let profile: Profile;
    let view: PackageView;
    try {
      profile = this.loader.load(name);
      view = this.target.build(profile);
    } catch (error) {
      this.output.error(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    const findings = await this.validator.validate(view, profile, context);
    this.report(name, findings);
    const errors = Validator.errors(findings);
    this.output.log(
      `[${name}] ${this.target.id} ${profile.version}: ${profile.skills.size} skills, ${view.size} files, ` +
        `${errors.length} error(s), ${Validator.warnings(findings).length} warning(s)`,
    );
    if (errors.length > 0) return null;
    if (!write) return "validated";

    const archive = this.target.archiveName(profile);
    const bytes = this.archiver.archive(view);
    const sha256 = Archiver.sha256(bytes);
    this.writeTree(join(this.outDir, profile.name, this.target.id), view);
    mkdirSync(this.outDir, { recursive: true });
    writeFileSync(join(this.outDir, archive), bytes);
    this.output.log(`[${name}] ${this.display(join(this.outDir, archive))}  sha256 ${sha256}`);
    return { profile: profile.name, archive, sha256 };
  }

  private writeTree(directory: string, view: PackageView): void {
    rmSync(directory, { recursive: true, force: true });
    for (const [path, bytes] of view) {
      const destination = join(directory, path);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, bytes);
    }
  }

  private report(name: string, findings: readonly Finding[]): void {
    for (const finding of findings) {
      const where = finding.path ? ` ${finding.path}:` : "";
      const line = `[${name}] ${finding.severity.toUpperCase()} ${finding.rule}${where} ${finding.message}`;
      if (finding.severity === "error") this.output.error(line);
      else this.output.log(line);
    }
  }

  private display(path: string): string {
    const shown = relative(process.cwd(), path);
    return shown.startsWith("..") ? path : shown;
  }

  static parse(argv: readonly string[]): ParsedArgs {
    const [command = "help", ...rest] = argv;
    if (!["build", "validate", "help", "--help", "-h"].includes(command)) {
      throw new Error(`Unknown command "${command}"`);
    }
    let profile: string | undefined;
    let online = false;
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];
      if (arg === "--online") online = true;
      else if (arg === "--profile") profile = rest[(index += 1)];
      else if (arg?.startsWith("--profile=")) profile = arg.slice("--profile=".length);
      else throw new Error(`Unknown argument "${String(arg)}"`);
    }
    if (command !== "build" && command !== "validate") return { command: "help", profile: "", online };
    if (!profile) throw new Error("--profile <name|all> is required");
    if (online && command === "build") throw new Error("--online applies to validate only");
    return { command, profile, online };
  }

  static readonly USAGE = [
    "usage:",
    "  npm run build -- --profile <yachtsy|all>",
    "  npm run validate -- [--online] --profile <yachtsy|all>",
  ].join("\n");
}
