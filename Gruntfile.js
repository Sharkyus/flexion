/*global module:false*/
module.exports = function(grunt) {
  // Project configuration.
  grunt.initConfig({
    // Metadata.
    ngdocs: {
      target : {
        scripts: ['flexion.js'],
      }
    }
  });
  
  grunt.loadNpmTasks('grunt-ngdocs');
 // grunt.loadNpmTasks('grunt-contrib-cssmin');

  // Default task.
  grunt.registerTask('default', ['ngdocs']);

};
