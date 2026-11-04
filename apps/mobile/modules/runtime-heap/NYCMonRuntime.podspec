Pod::Spec.new do |s|
  s.name = 'NYCMonRuntime'
  s.version = '0.1.0'
  s.summary = 'NYC-MON Hermes heap sizing with native inspector support'
  s.homepage = 'https://github.com/mikevocalz/nyc-mon'
  s.author = 'NYC-MON'
  s.license = { :type => 'MIT', :file => 'LICENSE' }
  s.source = { :git => '' }
  s.platforms = { :ios => '15.1' }
  s.static_framework = true
  s.source_files = 'ios/*.{h,mm}'
  s.public_header_files = 'ios/NYCMonRuntimeFactory.h'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20', 'HEADER_SEARCH_PATHS' => '"${PODS_ROOT}/React-Core-prebuilt/Headers"' }
  s.dependency 'React-RuntimeHermes'
end
