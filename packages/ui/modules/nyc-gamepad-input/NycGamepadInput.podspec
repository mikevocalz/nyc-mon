require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'NycGamepadInput'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'NYC-MON'
  s.homepage       = 'https://github.com/mikevocalz/nyc-mon'
  # GCKeyboard, GCKeyCode and buttonHome need iOS 14; the app already targets 16.4.
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.frameworks = 'GameController'

  s.source_files = [
    # Implementation (Swift)
    'ios/**/*.{swift}',
  ]

  # Adds the Nitrogen output (shared C++ specs, Swift-C++ bridge, autolinking
  # registration) and the NitroModules dependency.
  load File.join(__dir__, 'nitrogen/generated/ios/NycGamepadInput+autolinking.rb')
  add_nitrogen_files(s)

  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
