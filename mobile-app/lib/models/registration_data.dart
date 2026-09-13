// [DPA] RegistrationData — data transfer object for the multi-step registration flow.
// Only fields strictly required for account creation are included (Data Minimization).
class RegistrationData {
  String firstName;
  String lastName;
  String middleInitial;
  String email;
  String username;
  String password;
  String role;
  String mobileNumber;
  String caregiverType; // 'facility' | 'freelance'
  String facilityName;

  RegistrationData({
    this.firstName = '',
    this.lastName = '',
    this.middleInitial = '',
    this.email = '',
    this.username = '',
    this.password = '',
    this.role = '',
    this.mobileNumber = '',
    this.caregiverType = '',
    this.facilityName = '',
  });

  // Convert to JSON for HTTP posting to POST /api/auth/register
  // [OWASP A05] Keys match the backend's expected field names exactly.
  Map<String, dynamic> toJson() {
    final registersWithFacility = caregiverType == 'facility';

    return {
      'first_name': firstName.trim(),
      'last_name': lastName.trim(),
      'middle_initial': middleInitial.trim(),
      'email': email.trim().toLowerCase(), // [OWASP A02] Enforce normalization
      'username': username.trim(),
      'password': password,
      'role': role,
      'mobile_number': mobileNumber.trim(),
      'has_facility': registersWithFacility,
      if (registersWithFacility && facilityName.trim().isNotEmpty)
        'facility_name': facilityName.trim(),
    };
  }
}
