Pod::Spec.new do |s|
  s.name           = 'KeychainWidget'
  s.version        = '0.1.0'
  s.summary        = 'Mon keychain widget bridge'
  s.description    = 'Writes the keychain snapshot JSON to the App Group defaults and reloads the WidgetKit timeline.'
  s.author         = 'NYC-MON'
  s.homepage       = 'https://github.com/mikevocalz/nyc-mon'
  s.platforms      = { :ios => '15.1' }
  # Swift 5 language mode: the two calls are any-thread safe (UserDefaults, WidgetCenter),
  # and the module was not compiled against ExpoModulesCore's Swift 6 checks in this lane.
  s.swift_version  = '5.10'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WidgetKit'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  s.source_files = "**/*.{h,m,mm,swift}"
end
