class RegistrationData {
  String firstName;
  String lastName;
  String middleInitial;
  String email;
  String username;
  String password;
  String role;

  RegistrationData({
    this.firstName = '',
    this.lastName = '',
    this.middleInitial = '',
    this.email = '',
    this.username = '',
    this.password = '',
    this.role = '',
  });

  // Convert to JSON for HTTP posting
  Map<String, dynamic> toJson() {
    return {
      'first_name': firstName.trim(),
      'last_name': lastName.trim(),
      'middle_initial': middleInitial.trim(),
      'email': email.trim().toLowerCase(), // Enforce normalization
      'username': username.trim(),
      'password': password,
      'role': role,
    };
  }
}
