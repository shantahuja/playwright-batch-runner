#!groovy
@Library(['common-pipeline-lib']) _
Random random = new Random()

def opts = [
    credsRepository: 'your-creds-id',
    agentLabel: 'docker-node',
    container: 'dind',
];
def TD_HOST = params.TD_HOST ?: ''
def DEFAULT_BRANCH = env.BRANCH_NAME?.trim()
def isPR = DEFAULT_BRANCH?.toLowerCase()?.contains('pr-')  // Check if it's a PR branch

// Define variables at the top (but don't assign yet)
def BUILD_CAUSE = ""
def BUILD_NUMBER_UP = ""
def BUILD_NUMBER_DOWN = ""

pipeline {
  agent { label "${opts.agentLabel}" }
  parameters {
    string(name: 'BUILD_TYPE', defaultValue: '', description: 'Build type (SNAPSHOT/RELEASE)')
    string(name: 'RELEASE_VERSION', defaultValue: '', description: 'Current release version')
    string(name: 'NEXT_VERSION', defaultValue: '', description: 'Next development version')
  }
  environment {
    PATH = "${env.WORKSPACE}/node:${env.PATH}"
  }

  tools {
    maven "maven-3.6"
    jdk "JDK11"
  }

  stages {
    stage('Extract Version Info') {
      steps {
        script {
          echo "🔍 Initial params.RELEASE_VERSION: '${params.RELEASE_VERSION}'"
          echo "🔍 Initial params.MANUAL_SNAPSHOT: '${params.MANUAL_SNAPSHOT}'"

          // --- Variable Declarations ---
          def fullVersion
          def releaseVersion
          def nextVersion
          def buildType

          // --- Handle MANUAL_SNAPSHOT override ---
          if (params.MANUAL_SNAPSHOT?.trim()) {
            def manualSnapshotVersion = params.MANUAL_SNAPSHOT.trim()
            echo "📦 MANUAL_SNAPSHOT provided: ${manualSnapshotVersion}"

            buildType = "RELEASE"
            releaseVersion = manualSnapshotVersion
            env.RELEASE_VERSION = manualSnapshotVersion
            env.MANUAL_SNAPSHOT = manualSnapshotVersion

            currentBuild.displayName = "#${env.BUILD_NUMBER} ${manualSnapshotVersion}"

            properties([
              parameters([
                string(name: '=== RELEASE INFO ===', defaultValue: '', description: ' '),
                string(name: 'BUILD_TYPE', defaultValue: buildType, description: 'Build type (SNAPSHOT/RELEASE)'),
                string(name: 'RELEASE_VERSION', defaultValue: releaseVersion, description: 'Manual snapshot version entered'),
                string(name: 'NEXT_VERSION', defaultValue: '', description: ' '),

                string(name: '=== BATCH CONTROL ===', defaultValue: '', description: ' '),
                string(name: 'IS_BATCH', defaultValue: '', description: 'To run a singular batch, enter "BATCH".'),
                string(name: 'BATCH_NUMBER', defaultValue: '', description: 'If running a singular batch, enter the batch integer number.'),

                string(name: '=== MANUAL SNAPSHOT CONTROL ===', defaultValue: '', description: ' '),
                string(name: 'MANUAL_SNAPSHOT', defaultValue: '', description: 'Optional: Manually specify a snapshot version to override all auto-handling.')
              ])
            ])

            return
          }

          // --- Normal Version Extraction Flow ---
          if (params.RELEASE_VERSION?.trim() && !params.RELEASE_VERSION.contains("SNAPSHOT")) {
            fullVersion = params.RELEASE_VERSION.trim()
            echo "✅ Using manually set RELEASE_VERSION: ${fullVersion}"
          } else {
            fullVersion = sh(script: "mvn help:evaluate -Dexpression=project.version -q -DforceStdout", returnStdout: true).trim()
            echo "🔍 Using Maven extracted version: ${fullVersion}"
          }

          releaseVersion = fullVersion.replaceAll("-SNAPSHOT", "")
          echo "🔍 Release version (without -SNAPSHOT): ${releaseVersion}"

          def versionParts = releaseVersion.tokenize('.')
          versionParts[-1] = (versionParts[-1].toInteger() + 1).toString()
          nextVersion = versionParts.join('.') + "-SNAPSHOT"
          echo "📌 Next development version: ${nextVersion}"

          buildType = "SNAPSHOT"
          if (params.version?.trim() && !params.version.contains("SNAPSHOT")) {
            buildType = "RELEASE"
            releaseVersion = params.version
            echo "✅ Setting build type to RELEASE with version: ${releaseVersion}"
          } else if (!params.version?.trim()) {
            buildType = fullVersion.endsWith("-SNAPSHOT") ? "SNAPSHOT" : "RELEASE"
            echo "✅ Auto-detected build type: ${buildType}"
          }

          env.RELEASE_VERSION = releaseVersion

          if (buildType == "SNAPSHOT") {
            releaseVersion += "-SNAPSHOT"
            currentBuild.displayName = "#${env.BUILD_NUMBER} ${nextVersion}"
          } else {
            currentBuild.displayName = "#${env.BUILD_NUMBER} ${releaseVersion}"
          }

          env.RELEASE_VERSION = releaseVersion

          // --- Batch Running Logic ---
          if (params.BATCH_NUMBER?.trim()) {
            if (!params.BATCH_NUMBER.isInteger() || params.BATCH_NUMBER.toInteger() <= 0) {
              error("❌ Invalid BATCH_NUMBER value: '${params.BATCH_NUMBER}'. Please enter a positive integer or leave it empty.")
            } else {
              echo "✅ BATCH_NUMBER is valid: ${params.BATCH_NUMBER}"
            }
          }

          if (params.IS_BATCH?.trim()) {
            def isBatchInput = params.IS_BATCH.trim().toUpperCase()

            if (isBatchInput != 'BATCH') {
              error("❌ Invalid IS_BATCH value: '${params.IS_BATCH}'. Please enter 'BATCH' or leave it empty.")
            }

            if (!params.BATCH_NUMBER?.trim() || !params.BATCH_NUMBER.isInteger() || params.BATCH_NUMBER.toInteger() <= 0) {
              error("❌ IS_BATCH is 'BATCH' but BATCH_NUMBER is missing or invalid. Please enter a positive integer in BATCH_NUMBER.")
            }

            echo "✅ IS_BATCH set to 'BATCH' with valid BATCH_NUMBER: ${params.BATCH_NUMBER}"
            env.IS_BATCH = isBatchInput
            env.BATCH_NUMBER = params.BATCH_NUMBER
          }

          properties([
            parameters([
              string(name: '=== RELEASE INFO ===', defaultValue: '', description: ' '),
              string(name: 'BUILD_TYPE', defaultValue: buildType, description: 'Build type (SNAPSHOT/RELEASE)'),
              string(name: 'RELEASE_VERSION', defaultValue: releaseVersion, description: 'Current release version'),
              string(name: 'NEXT_VERSION', defaultValue: nextVersion, description: 'Next development version'),

              string(name: '=== BATCH CONTROL ===', defaultValue: '', description: ' '),
              string(name: 'IS_BATCH', defaultValue: '', description: 'To run a singular batch, enter "BATCH".'),
              string(name: 'BATCH_NUMBER', defaultValue: '', description: 'If running a singular batch, enter the batch integer number.'),

              string(name: '=== MANUAL SNAPSHOT CONTROL ===', defaultValue: '', description: ' '),
              string(name: 'MANUAL_SNAPSHOT', defaultValue: '', description: 'Optional: Manually specify a snapshot version to override all auto-handling.')
            ])
          ])
        }
      }
    }
    
    stage("Setup") {
      steps {
        echo "Setup stage if needed..."
        script {
          // Assign values inside a step
          def queue = currentBuild.getBuildCauses()
          
          // Process all causes, including upstream and any triggers
          def causes = queue.collect { it.shortDescription }

          // Get the full build cause string, including any upstream causes
          // Ensure that causes are joined correctly, and avoid repetition
          BUILD_CAUSE = causes.unique().join(" → ") ?: "Unknown Build Cause"
          
          // Now we capture the build numbers for clarity
          BUILD_NUMBER_UP = params.buildNumber ?: "N/A"
          BUILD_NUMBER_DOWN = env.BUILD_NUMBER

          // Additional logging for debugging
          echo "🔹 Full Build Cause: ${BUILD_CAUSE}"
          echo "🔹 Upstream Build Number: ${BUILD_NUMBER_UP}"
        }
      }
    }

    stage("Clone and Deploy") {
      steps {
        script {
          def COMMIT_AUTHOR = ''
          def COMMIT_EMAIL = ''
          def COMMIT_MESSAGE = ''
          def UPSTREAM_BRANCH = ''
          def sha = params.buildSha1?.trim()

          try {
            // If buildSha1 is provided, this is a downstream job
            if (sha) {
              echo "🔹 Using buildSha1: ${sha}"

              // Check for branch in BUILD_CAUSE 
              // (looking for "Started by upstream project star4/groups/org/org-library/branchFromCause build number 90")
              // you can add other org libraries to the matcher if you want
              def branchFromCause = null
              def matcher = BUILD_CAUSE =~ /org-(library|other-library)\/([^"]+)/
              if (matcher.find()) {
                branchFromCause = java.net.URLDecoder.decode(matcher.group(2), "UTF-8")
                echo "🧠 Inferred branch from build cause: ${branchFromCause}"

                if (branchFromCause) {
                  echo "🔹 Checking out branch ${branchFromCause} in your-upstream-repo repository"

                  // Checkout the branch from your-upstream-repo using GitSCM
                  withCredentials([
                    usernamePassword(
                      credentialsId: 'github-credentials', 
                      usernameVariable: 'GIT_USERNAME', 
                      passwordVariable: 'GIT_PASSWORD'
                    )
                  ]) {
                    echo "🔹 Fetching commit info for SHA ${sha} from your-upstream-repo"

                    // Fetch the commit info from your-upstream-repo without cloning (this is ideal)
                    // Uncomment this when ls-remote works (it currently hangs the build)
                    // def lsRemoteResponse = sh(script: "git ls-remote https://code.devorg.com/dev/your-upstream-repo.git refs/heads/${branchFromCause}", returnStdout: true).trim()
                    // echo "🔹 ls-remote response: ${lsRemoteResponse}"

                    // Extract the commit hash from ls-remote output
                    // def commitHash = lsRemoteResponse.split()[0]
                    // echo "🔹 Commit hash: ${commitHash}"

                    // Here, you would use jq or other methods to parse the commit info if needed
                    // For example, assuming the output of ls-remote contains the commit hash, you can use it to get detailed commit info
                    // But right now, we're keeping it commented out because ls-remote hangs in the build
                    // COMMIT_AUTHOR = sh(script: "git show ${commitHash} -s --format=%an", returnStdout: true).trim()
                    // COMMIT_EMAIL = sh(script: "git show ${commitHash} -s --format=%ae", returnStdout: true).trim()
                    // COMMIT_MESSAGE = sh(script: "git show ${commitHash} -s --format=%s", returnStdout: true).trim()

                    // Since ls-remote isn't working for now, we'll proceed with the full clone (as a fallback)
                    dir('temp-your-upstream-repo') {
                      // Checkout the your-upstream-repo repo and its branch into the temp-your-upstream-repo directory
                      checkout([
                        $class: 'GitSCM',
                        branches: [[name: "refs/heads/${branchFromCause}"]],
                        doGenerateSubmoduleConfigurations: false,
                        userRemoteConfigs: [[
                          credentialsId: 'github-repo-scanner', 
                          url: 'https://code.devorg.com/dev/your-upstream-repo.git'
                        ]]
                      ])

                      // After the repo is cloned, use git show to fetch commit details
                      COMMIT_AUTHOR = sh(script: "git show -s --format=%an ${sha}", returnStdout: true).trim()
                      COMMIT_EMAIL = sh(script: "git show -s --format=%ae ${sha}", returnStdout: true).trim()
                      COMMIT_MESSAGE = sh(script: "git show -s --format=%s ${sha}", returnStdout: true).trim()
                      UPSTREAM_BRANCH = branchFromCause
                    }

                    echo "🔹 COMMIT_AUTHOR: ${COMMIT_AUTHOR}"
                    echo "🔹 COMMIT_EMAIL: ${COMMIT_EMAIL}"
                    echo "🔹 COMMIT_MESSAGE: ${COMMIT_MESSAGE}"
                  }
                } else {
                  echo "⚠️ Unable to extract branch from build cause: ${BUILD_CAUSE}"
                }
              } else {
                echo "⚠️ Unable to extract branch from build cause: ${BUILD_CAUSE}"
              }

            } else {
              // No buildSha1 provided, this is a local build (work with current repo)
              echo "⚠️ No buildSha1 provided — this is a local build, commit info from HEAD"
              sha = "HEAD" // Use HEAD as the fallback
              COMMIT_AUTHOR  = sh(script: "git show -s --format=%an ${sha}", returnStdout: true).trim()
              COMMIT_EMAIL   = sh(script: "git show -s --format=%ae ${sha}", returnStdout: true).trim()
              COMMIT_MESSAGE = sh(script: "git show -s --format=%s ${sha}", returnStdout: true).trim()
            }

          } catch (err) {
            echo "⚠️ Failed to fetch commit metadata: ${err.getMessage()}"
          }

          env.COMMIT_AUTHOR = COMMIT_AUTHOR
          env.COMMIT_EMAIL = COMMIT_EMAIL
          env.COMMIT_MESSAGE = COMMIT_MESSAGE
          env.UPSTREAM_BRANCH = UPSTREAM_BRANCH

          echo "🔹 COMMIT_AUTHOR: ${env.COMMIT_AUTHOR}"
          echo "🔹 COMMIT_EMAIL: ${env.COMMIT_EMAIL}"
          echo "🔹 COMMIT_MESSAGE: ${env.COMMIT_MESSAGE}"
          echo "🔹 UPSTREAM_BRANCH: ${env.UPSTREAM_BRANCH}"

          // Clean up temporary clone directory
          echo "🧹 Cleaning up temp-your-upstream-repo directory..."
          sh "rm -rf ${WORKSPACE}/temp-your-upstream-repo"
          sh "ls ${WORKSPACE}/temp-your-upstream-repo || echo 'Directory removed successfully.'"

          echo "Cloning your-playwright-repo"
          dir('your-playwright-repo') {
            echo "Current directory: ${pwd()}"
            
            print "DEBUG: environment variable BRANCH_NAME = ${DEFAULT_BRANCH}"
            print "DEBUG: isPR = ${isPR}"

            // Determine the default branch based on whether this is a PR build
            if (isPR) {
              // Reassign DEFAULT_BRANCH to CHANGE_BRANCH when it contains 'PR' (this is a PR build)
              DEFAULT_BRANCH = env.CHANGE_BRANCH
              echo "BRANCH_NAME is '${env.BRANCH_NAME}'."
              echo "Since it contains 'PR', DEFAULT_BRANCH was reassigned to CHANGE_BRANCH: '${env.CHANGE_BRANCH}'."
            } else {
              // Keep as DEFAULT_BRANCH as BRANCH_NAME (this is a base branch build)
              echo "BRANCH_NAME is '${env.BRANCH_NAME}'."
              echo "Since it does not contain 'PR', DEFAULT_BRANCH remains as: '${DEFAULT_BRANCH}'."
            }

            print "DEBUG: default branch = ${DEFAULT_BRANCH}"
            
            // Checkout the main playwright repo first
            checkout([
              $class: 'GitSCM',
              branches: [[name: DEFAULT_BRANCH]],
              doGenerateSubmoduleConfigurations: false,
              userRemoteConfigs: [[
                credentialsId: 'github-credentials', 
                url: 'https://code.devorg.com/dev/your-playwright-repo/'
              ]]
            ])
            echo "Finished Cloning!"
            echo "Building and Deploying to Instance"
          }
        }
      }
    }

    stage("Running Sanity tests in Docker") { 
      steps {
        dir ('your-playwright-repo') {
          container(opts.container) {
            withCredentials([
              usernamePassword(
                  credentialsId: opts.credsRepository,
                  usernameVariable: 'ARTIFACT_NEXUS_USERNAME',
                  passwordVariable: 'ARTIFACT_NEXUS_PASSWORD'
              ) 
            ]) {
              // Ensure .npmrc is correctly used and accessible (don't write manually)
              sh "./npmrc.sh"
            }
            withCredentials([
              usernamePassword(
                credentialsId: 'your-creds-id', 
                usernameVariable: 'TEST_USERNAME', 
                passwordVariable: 'TEST_PASSWORD'
              ),
              string(
                credentialsId: 'teams-webhook-url', 
                variable: 'TEAMS_WEBHOOK_URL'
              )
            ]) {
              script {
                print "DEBUG: environment variable npmArtifact = ${env.npmArtifact}"
                print "DEBUG: parameter RELEASE_VERSION = ${params.RELEASE_VERSION}"
                print "DEBUG: environment variable version = ${env.version}"

                def dockerTag = "sanity:${env.BUILD_NUMBER}"

                echo "DEBUG: Using Docker tag: ${dockerTag}"

                // Build Docker image and check if it succeeds
                def testResult = sh(script: """ 
                  docker build -f Dockerfile \
                    --progress=plain \
                    --no-cache \
                    --force-rm \
                    --build-arg version=${params.version} \
                    --build-arg NPM_ARTIFACT=${env.npmArtifact} \
                    --build-arg RELEASE_VERSION=${env.RELEASE_VERSION} \
                    --build-arg MANUAL_SNAPSHOT=${env.MANUAL_SNAPSHOT} \
                    --build-arg IS_BATCH=${env.IS_BATCH} \
                    --build-arg BATCH_NUMBER=${env.BATCH_NUMBER} \
                    --build-arg TEST_USERNAME=$TEST_USERNAME \
                    --build-arg TEST_PASSWORD=$TEST_PASSWORD \
                    --build-arg IS_PR=${isPR} \
                    --build-arg BUILD_CAUSE="${BUILD_CAUSE}" \
                    --build-arg COMMIT_AUTHOR="${COMMIT_AUTHOR}" \
                    --build-arg COMMIT_EMAIL="${COMMIT_EMAIL}" \
                    --build-arg COMMIT_MESSAGE="${COMMIT_MESSAGE}" \
                    --build-arg UPSTREAM_BRANCH="${UPSTREAM_BRANCH}" \
                    --build-arg BUILD_NUMBER_UP="${BUILD_NUMBER_UP}" \
                    --build-arg BUILD_NUMBER_DOWN="${BUILD_NUMBER_DOWN}" \
                    --build-arg TEAMS_WEBHOOK_URL="${TEAMS_WEBHOOK_URL}" \
                    --build-arg BUILD_URL="${env.BUILD_URL}" \
                    -t ${dockerTag} .
                  """, returnStatus: true)

                if (testResult == 86) {
                  echo "⚠️ EMPTY_SNAPSHOT detected during Docker build."
                  currentBuild.displayName = "#${env.BUILD_NUMBER} EMPTY_SNAPSHOT"
                  currentBuild.description = """
                  🚫 Snapshot not found in registry.
                  📦 Version: ${env.RELEASE_VERSION}
                  👤 Commit Author: ${env.COMMIT_AUTHOR}
                  💬 Commit Message: ${env.COMMIT_MESSAGE}
                  """.stripIndent().trim()
                  error("❌ Stopping build because snapshot is missing in registry.")
                } else if (testResult == 87) {
                  echo "⚠️ BATCH_OUT_OF_BOUNDS detected during Docker build."
                  currentBuild.displayName = "#${env.BUILD_NUMBER} BATCH_OUT_OF_BOUNDS"
                  currentBuild.description = "User entered a batch number that does not exist. Check available batches."
                  error("❌ Stopping build because batch number is invalid.")
                } else if (testResult != 0) {
                  echo "❌ Docker build failed for other reasons."
                  error("❌ Docker build failed.")
                }

                // List all docker images to ensure the image exists
                sh 'docker images'

                // Get the image ID for the tag that was built
                def imageId = sh(script: "docker images --quiet ${dockerTag}", returnStdout: true).trim()
                echo "DEBUG: Image ID: ${imageId}"

                // Check if the image ID exists
                echo "DEBUG: Checking if image exists with ID ${imageId}..."
                sh """ 
                  docker images -a | grep ${imageId} || (echo 'Docker image not found!'; exit 1)
                """

                // Ensure any existing container is removed before starting a new one
                sh """
                  docker rm -f sanity-test || true
                  docker run -d --name sanity-test ${imageId} tail -f /dev/null
                """

                // Wait for a few seconds to ensure the container starts properly
                sh "sleep 10"

                // Check container logs if it's not running
                sh """
                  docker ps -a | grep sanity-test || (echo 'Sanity test container not running, checking logs'; docker logs sanity-test; exit 1)
                """

                // Count the number of test result files matching the patterns
                def testResultsFiles = sh(script: """
                  docker exec sanity-test find /srv/test-results -type f \\( -name "*.png" -o -name "*.webm" -o -name "*.zip" \\) | wc -l
                """, returnStdout: true).trim()

                // If there's no output or it's empty, set it to 0
                testResultsFiles = testResultsFiles.isEmpty() ? '0' : testResultsFiles
                echo "Number of test result files found: ${testResultsFiles}"

                // If there are any directories, proceed with copying and zipping the files
                if (testResultsFiles.toInteger() > 0) {
                  echo "Found test result folders. Proceeding with file copy and build marking."

                  // Verify the test results inside the container (check the mounted directory)
                  try {
                      echo 'Listing specific files (png, webm, zip) inside /srv/test-results:'
                      def files = sh(script: "docker exec sanity-test find /srv/test-results -type f \\( -name \"*.png\" -o -name \"*.webm\" -o -name \"*.zip\" \\)", returnStdout: true).trim()
                      echo "Found files: ${files}"
                  } catch (Exception e) {
                      echo "Error verifying docker test results: ${e.getMessage()}"
                  }

                  // Ensure the destination directory exists before copying
                  sh "mkdir -p ${WORKSPACE}/test-results"

                  // Declare variables outside the loop in Groovy context
                  def relative_path, target_dir, dir

                  // Copy the test results from the container to the Jenkins workspace
                  sh """
                    echo 'Listing the contents of /srv/test-results before copying the files:'
                    docker exec sanity-test find /srv/test-results -type f -name '*.png' -o -name '*.webm' -o -name '*.zip' | while read file; do
                      echo 'Extract the file path relative to /srv/test-results using Groovy string manipulation'
                      
                      relative_path=\$(echo "\$file" | sed 's|/srv/test-results/||')
                      target_dir="${WORKSPACE}/test-results/\${relative_path}"
                      dir=\$(dirname "\${target_dir}")

                      echo 'Create the directory structure in the destination using Groovy'
                      
                      mkdir -p "\${dir}"
                      
                      echo "Copying file: \$file"
                      docker cp "sanity-test:\$file" "${WORKSPACE}/test-results/\${relative_path}"
                    done
                  """

                  // Get the current working directory dynamically
                  def workspaceDir = pwd()

                  // Now, zip the files in test-results but move the zip outside the test-results folder
                  sh "rm -rf ${WORKSPACE}/test-results.zip"  // Ensure no old zip exists

                  // Zip the files and place the zip in the workspace
                  def zipFile = "${WORKSPACE}/test-results-${env.RELEASE_VERSION}-${env.BUILD_NUMBER}.zip"
                  sh """
                    cd ${WORKSPACE}/test-results
                    zip -r ${zipFile} ./*
                  """

                  // Check if zip file exists
                  sh "pwd"  // Confirm the current directory
                  sh "ls -l ${WORKSPACE}/test-results-${env.RELEASE_VERSION}-${env.BUILD_NUMBER}.zip"  // This will confirm if the zip file was created

                  // Now, copy the zip file to the dynamically defined workspace directory
                  sh "cp ${WORKSPACE}/test-results-${env.RELEASE_VERSION}-${env.BUILD_NUMBER}.zip ${workspaceDir}/"
                  sh "ls -l ${workspaceDir}/test-results-${env.RELEASE_VERSION}-${env.BUILD_NUMBER}.zip"  // This will confirm if the zip file was copied

                  // Archive the zip file from the dynamic workspace directory
                  archiveArtifacts artifacts: "test-results-${env.RELEASE_VERSION}-${env.BUILD_NUMBER}.zip", allowEmptyArchive: true, fingerprint: true

                  // Check if any folder contains 'retry2' in its name
                  def retry2Folders = sh(script: "docker exec sanity-test find /srv/test-results -type d -name '*retry2*' | wc -l", returnStdout: true).trim()
                  echo "Number of 'retry2' folders found: ${retry2Folders}"

                  // If we find 'retry2' folders, mark the build as FAILURE
                  if (retry2Folders.toInteger() > 0) {
                    currentBuild.result = 'FAILURE'
                    echo "Build marked as FAILURE because 'retry2' folders were found."
                  }
                } else {
                  echo "No test result files found. Skipping test-results file copy and build checking."
                }
              }
            }
          }
        }
      }
    }
  }
}