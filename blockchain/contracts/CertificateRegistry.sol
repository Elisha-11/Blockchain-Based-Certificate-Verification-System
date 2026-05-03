// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CertificateRegistry {
    // Mapping from cert_id (bytes32) to its hash (bytes32)
    mapping(bytes32 => bytes32) public certificateHashes;
    
    // Mapping from cert_id to issuer address (for accountability)
    mapping(bytes32 => address) public issuers;
    
    // Event emitted when a certificate is registered
    event CertificateRegistered(bytes32 indexed certId, bytes32 hash, address issuer);
    
    // Event emitted when a certificate is revoked
    event CertificateRevoked(bytes32 indexed certId, address revoker);

    // Modifier to ensure only authorized issuers can register (simplified for prototype)
    // In production, you would use AccessControl from OpenZeppelin
    modifier onlyAuthorized() {
        // For prototype: Allow any caller. 
        // TODO: Restrict to specific institution addresses in Phase 4
        _;
    }

    /**
     * @dev Register a new certificate hash on-chain
     * @param certId The unique ID of the certificate (converted to bytes32)
     * @param hash The SHA-256 hash of the certificate data
     */
    function registerCertificate(bytes32 certId, bytes32 hash) external onlyAuthorized {
        require(certificateHashes[certId] == bytes32(0), "Certificate already registered");
        require(hash != bytes32(0), "Hash cannot be zero");
        
        certificateHashes[certId] = hash;
        issuers[certId] = msg.sender;
        
        emit CertificateRegistered(certId, hash, msg.sender);
    }

    /**
     * @dev Verify a certificate hash against the on-chain record
     * @param certId The unique ID of the certificate
     * @param hash The SHA-256 hash to verify
     * @return isValid True if the hash matches the on-chain record
     */
    function verifyCertificate(bytes32 certId, bytes32 hash) external view returns (bool isValid) {
        return certificateHashes[certId] == hash;
    }

    /**
     * @dev Revoke a certificate (mark hash as zero)
     * @param certId The unique ID of the certificate
     */
    function revokeCertificate(bytes32 certId) external {
        require(certificateHashes[certId] != bytes32(0), "Certificate not found");
        require(issuers[certId] == msg.sender, "Only issuer can revoke");
        
        delete certificateHashes[certId];
        emit CertificateRevoked(certId, msg.sender);
    }
}