import Foundation
import Security

// Device-only unlocked Keychain items, never synchronizable. No token-returning bridge method.
final class CourierCredentials {
    private let service="is.huginn.foundation.dev.courier.fixture.v1"
    private func query(_ ref: String) throws -> [String:Any] { try require(ref.range(of:"^(fixture|paired)-[0-9a-f]{32}$",options:.regularExpression) != nil,"CREDENTIAL_REF");return [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:ref,kSecAttrSynchronizable as String:false] }
    private let synthetic=Data("SYNTHETIC-COURIER-CREDENTIAL-NOT-A-PAIRING".utf8)
    func storeFixture(_ ref: String) throws { try storeNative(ref,synthetic) }
    // Native-only future pairing seam; no token-returning JavaScript operation.
    func storeNative(_ ref: String,_ token: Data) throws { try require(!token.isEmpty && token.count<=4096,"CREDENTIAL_SIZE");var q=try query(ref);SecItemDelete(q as CFDictionary);q[kSecValueData as String]=token;q[kSecAttrAccessible as String]=kSecAttrAccessibleWhenUnlockedThisDeviceOnly;try require(SecItemAdd(q as CFDictionary,nil)==errSecSuccess,"KEYCHAIN_WRITE") }
    func readNative(_ ref: String) throws -> Data? { var q=try query(ref);q[kSecReturnData as String]=true;q[kSecMatchLimit as String]=kSecMatchLimitOne;var out: CFTypeRef?;let result=SecItemCopyMatching(q as CFDictionary,&out);if result==errSecItemNotFound { return nil };try require(result==errSecSuccess,"KEYCHAIN_READ");return out as? Data }
    func exists(_ ref: String) throws -> Bool { guard let token=try readNative(ref) else { return false };return !token.isEmpty && token.count<=4096 }
    func delete(_ ref: String) throws { let result=SecItemDelete(try query(ref) as CFDictionary);try require(result==errSecSuccess || result==errSecItemNotFound,"KEYCHAIN_DELETE") }
    func probe() throws -> Bool { let ref="fixture-00000000000000000000000000000000";defer { try? delete(ref) };try storeFixture(ref);return try readNative(ref)==synthetic }
}
