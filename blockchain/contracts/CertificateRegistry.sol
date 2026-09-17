// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CertificateRegistry {
    struct Certificate {
        bytes32 hash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
        uint256 revokedAt;
    }

    address public owner;

    // Institutions allowed to register new certificates.
    mapping(address => bool) public authorisedInstitutions;

    // cert_id (bytes32) => certificate record
    mapping(bytes32 => Certificate) private certificates;

    event InstitutionAuthorised(address indexed institution);
    event InstitutionDeauthorised(address indexed institution);
    event CertificateRegistered(bytes32 indexed certId, bytes32 hash, address indexed issuer, uint256 issuedAt);
    event CertificateRevoked(bytes32 indexed certId, address indexed revoker, uint256 revokedAt);

    error NotOwner();
    error NotAuthorisedInstitution();
    error ZeroHash();
    error CertificateAlreadyRegistered();
    error CertificateNotFound();
    error CertificateAlreadyRevoked();
    error NotIssuerOrOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorisedInstitution() {
        if (!authorisedInstitutions[msg.sender]) revert NotAuthorisedInstitution();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Grants an institution permission to register certificates.
     */
    function authoriseInstitution(address institution) external onlyOwner {
        authorisedInstitutions[institution] = true;
        emit InstitutionAuthorised(institution);
    }

    /**
     * @dev Revokes an institution's permission to register new certificates.
     * Does not affect certificates it already issued, and does not affect
     * its ability to revoke those certificates.
     */
    function deauthoriseInstitution(address institution) external onlyOwner {
        authorisedInstitutions[institution] = false;
        emit InstitutionDeauthorised(institution);
    }

    /**
     * @dev Register a new certificate hash on-chain.
     * @param certId The unique ID of the certificate (converted to bytes32)
     * @param hash The SHA-256 hash of the certificate data
     */
    function registerCertificate(bytes32 certId, bytes32 hash) external onlyAuthorisedInstitution {
        if (hash == bytes32(0)) revert ZeroHash();
        if (certificates[certId].issuedAt != 0) revert CertificateAlreadyRegistered();

        certificates[certId] = Certificate({
            hash: hash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            revoked: false,
            revokedAt: 0
        });

        emit CertificateRegistered(certId, hash, msg.sender, block.timestamp);
    }

    /**
     * @dev Revoke a certificate. Only the issuing institution or the contract
     * owner may do this. Irreversible: there is no un-revoke function.
     * @param certId The unique ID of the certificate
     */
    function revokeCertificate(bytes32 certId) external {
        Certificate storage cert = certificates[certId];

        if (cert.issuedAt == 0) revert CertificateNotFound();
        if (cert.revoked) revert CertificateAlreadyRevoked();
        if (msg.sender != cert.issuer && msg.sender != owner) revert NotIssuerOrOwner();

        cert.revoked = true;
        cert.revokedAt = block.timestamp;

        emit CertificateRevoked(certId, msg.sender, block.timestamp);
    }

    /**
     * @dev Verify a certificate hash against the on-chain record.
     * @param certId The unique ID of the certificate
     * @param hash The SHA-256 hash to verify
     * @return exists True if a record for certId exists and its stored hash matches
     * @return revoked True if the certificate has been revoked
     * @return issuer The address that registered the certificate
     * @return issuedAt The timestamp the certificate was registered
     * @return revokedAt The timestamp the certificate was revoked (0 if not revoked)
     */
    function verifyCertificate(bytes32 certId, bytes32 hash)
        external
        view
        returns (bool exists, bool revoked, address issuer, uint256 issuedAt, uint256 revokedAt)
    {
        Certificate storage cert = certificates[certId];
        bool registered = cert.issuedAt != 0;

        exists = registered && cert.hash == hash;
        revoked = cert.revoked;
        issuer = cert.issuer;
        issuedAt = cert.issuedAt;
        revokedAt = cert.revokedAt;
    }
}
