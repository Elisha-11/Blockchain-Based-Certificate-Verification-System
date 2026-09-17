const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("CertificateRegistry", function () {
  let registry;
  let owner, institutionA, institutionB, outsider;

  const certIdA = ethers.id("CERT-A");
  const certIdB = ethers.id("CERT-B");
  const hashA = ethers.id("hash-of-cert-a");
  const hashB = ethers.id("hash-of-cert-b");

  beforeEach(async function () {
    [owner, institutionA, institutionB, outsider] = await ethers.getSigners();

    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    registry = await CertificateRegistry.deploy();
    await registry.waitForDeployment();
  });

  describe("deployment", function () {
    it("sets the deployer as owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  describe("authorisation", function () {
    it("lets the owner authorise an institution", async function () {
      await expect(registry.authoriseInstitution(institutionA.address))
        .to.emit(registry, "InstitutionAuthorised")
        .withArgs(institutionA.address);

      expect(await registry.authorisedInstitutions(institutionA.address)).to.equal(true);
    });

    it("reverts when a non-owner tries to authorise", async function () {
      await expect(
        registry.connect(institutionA).authoriseInstitution(institutionA.address)
      ).to.be.revertedWithCustomError(registry, "NotOwner");
    });

    it("lets the owner deauthorise an institution", async function () {
      await registry.authoriseInstitution(institutionA.address);

      await expect(registry.deauthoriseInstitution(institutionA.address))
        .to.emit(registry, "InstitutionDeauthorised")
        .withArgs(institutionA.address);

      expect(await registry.authorisedInstitutions(institutionA.address)).to.equal(false);
    });

    it("reverts when a non-owner tries to deauthorise", async function () {
      await registry.authoriseInstitution(institutionA.address);

      await expect(
        registry.connect(institutionB).deauthoriseInstitution(institutionA.address)
      ).to.be.revertedWithCustomError(registry, "NotOwner");
    });
  });

  describe("registerCertificate", function () {
    it("reverts when called by an unauthorised address", async function () {
      await expect(
        registry.connect(institutionA).registerCertificate(certIdA, hashA)
      ).to.be.revertedWithCustomError(registry, "NotAuthorisedInstitution");
    });

    it("lets an authorised institution register a certificate", async function () {
      await registry.authoriseInstitution(institutionA.address);

      await expect(registry.connect(institutionA).registerCertificate(certIdA, hashA))
        .to.emit(registry, "CertificateRegistered")
        .withArgs(certIdA, hashA, institutionA.address, anyValue);

      const result = await registry.verifyCertificate(certIdA, hashA);
      expect(result.exists).to.equal(true);
      expect(result.revoked).to.equal(false);
      expect(result.issuer).to.equal(institutionA.address);
    });

    it("reverts on a zero hash", async function () {
      await registry.authoriseInstitution(institutionA.address);

      await expect(
        registry.connect(institutionA).registerCertificate(certIdA, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "ZeroHash");
    });

    it("reverts when the certId is already registered", async function () {
      await registry.authoriseInstitution(institutionA.address);
      await registry.connect(institutionA).registerCertificate(certIdA, hashA);

      await expect(
        registry.connect(institutionA).registerCertificate(certIdA, hashB)
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyRegistered");
    });

    it("prevents a deauthorised institution from registering new certificates", async function () {
      await registry.authoriseInstitution(institutionA.address);
      await registry.deauthoriseInstitution(institutionA.address);

      await expect(
        registry.connect(institutionA).registerCertificate(certIdB, hashB)
      ).to.be.revertedWithCustomError(registry, "NotAuthorisedInstitution");
    });
  });

  describe("revokeCertificate", function () {
    beforeEach(async function () {
      await registry.authoriseInstitution(institutionA.address);
      await registry.authoriseInstitution(institutionB.address);
      await registry.connect(institutionA).registerCertificate(certIdA, hashA);
    });

    it("lets the issuing institution revoke its own certificate", async function () {
      await expect(registry.connect(institutionA).revokeCertificate(certIdA))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(certIdA, institutionA.address, anyValue);

      const result = await registry.verifyCertificate(certIdA, hashA);
      expect(result.revoked).to.equal(true);
    });

    it("lets the owner revoke a certificate it did not issue", async function () {
      await expect(registry.connect(owner).revokeCertificate(certIdA)).to.not.be.reverted;

      const result = await registry.verifyCertificate(certIdA, hashA);
      expect(result.revoked).to.equal(true);
    });

    it("reverts when a different institution tries to revoke someone else's certificate", async function () {
      await expect(
        registry.connect(institutionB).revokeCertificate(certIdA)
      ).to.be.revertedWithCustomError(registry, "NotIssuerOrOwner");
    });

    it("reverts when an unrelated outsider tries to revoke", async function () {
      await expect(
        registry.connect(outsider).revokeCertificate(certIdA)
      ).to.be.revertedWithCustomError(registry, "NotIssuerOrOwner");
    });

    it("reverts when revoking a certificate that was never registered", async function () {
      await expect(
        registry.connect(institutionA).revokeCertificate(certIdB)
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    });

    it("reverts on double revocation", async function () {
      await registry.connect(institutionA).revokeCertificate(certIdA);

      await expect(
        registry.connect(institutionA).revokeCertificate(certIdA)
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked");
    });

    it("lets a deauthorised institution still revoke its own certificate", async function () {
      await registry.deauthoriseInstitution(institutionA.address);

      await expect(registry.connect(institutionA).revokeCertificate(certIdA)).to.not.be.reverted;

      const result = await registry.verifyCertificate(certIdA, hashA);
      expect(result.revoked).to.equal(true);
    });
  });

  describe("verifyCertificate", function () {
    it("reports exists=false for a certId that was never registered", async function () {
      const result = await registry.verifyCertificate(certIdA, hashA);
      expect(result.exists).to.equal(false);
      expect(result.revoked).to.equal(false);
      expect(result.issuer).to.equal(ethers.ZeroAddress);
    });

    it("reports exists=false when the supplied hash does not match the stored one", async function () {
      await registry.authoriseInstitution(institutionA.address);
      await registry.connect(institutionA).registerCertificate(certIdA, hashA);

      const result = await registry.verifyCertificate(certIdA, hashB);
      expect(result.exists).to.equal(false);
      // still reports the real record's revocation state, not zeroed out
      expect(result.issuer).to.equal(institutionA.address);
    });
  });
});
