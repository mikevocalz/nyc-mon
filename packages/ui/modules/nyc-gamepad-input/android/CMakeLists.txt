project(NycGamepadInput)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME NycGamepadInput)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

# The only handwritten C++ is the JNI entry point; everything else is
# Nitrogen output pulled in by the generated cmake file below.
file(GLOB_RECURSE android_files RELATIVE ${CMAKE_SOURCE_DIR}
     "src/main/cpp/**.cpp"
)

add_library(${PACKAGE_NAME} SHARED
            ${android_files}
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/NycGamepadInput+autolinking.cmake)

include_directories(
        "src/main/cpp"
)

find_library(LOG_LIB log)

target_link_libraries(
        ${PACKAGE_NAME}
        ${LOG_LIB}
        android
)
