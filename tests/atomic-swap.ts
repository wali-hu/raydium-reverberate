import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("atomic-swap", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.AtomicSwap as Program;

  it("Is initialized!", async () => {
    // Add your test here.
    console.log("Your transaction signature", "test");
  });
});
