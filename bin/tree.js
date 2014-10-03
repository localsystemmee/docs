#!/usr/bin/env node

// Walk the content directory looking for markdown files
// and build an object of all the pages and sections (directories)

var path        = require("path")
var fs          = require("fs")
var marked      = require("marked")
var fmt         = require("util").format
var _           = require("lodash")
var compact     = _.compact
var uniq        = _.uniq
var pluck       = _.pluck
var merge       = _.merge
var fm          = require("html-frontmatter")
var contentFile = path.resolve(__dirname, "../content.json")
var liteFile = path.resolve(__dirname, "../content.lite.json")
var content = {
  sections: [],
  pages: []
}

// Walk the content directory tree
var emitter = require("walkdir")(path.resolve(__dirname,  "../content/"))

emitter.on("file", function(filename,stat){

  // We only want markdown files
  if (!filename.match(/\.md$/)) return

  var page = {}
  page.content = fs.readFileSync(filename).toString()

  // Look for HTML frontmatter
  merge(page, fm(page.content))

  // Look for man-pagey frontmatter

  // Example:
  // npm-completion(1) -- Tab Completion for npm
  // ===========================================

  var manPattern = new RegExp("^(.*) -- (.*)\n=+\n")
  if (page.content.match(manPattern)) {
    var manHead = manPattern.exec(page.content)
    page.heading = manHead[2]
    page.content = page.content.replace(manHead[0], "")
    // console.log(manHead)
  }

  // Convert markdown to HTML
  page.content = page.content
    .replace(/## SYNOPSIS/g, "## Synopsis")
    .replace(/## DESCRIPTION/g, "## Description")
    .replace(/## SEE ALSO/g, "## See Also")

  // Convert markdown to HTML
  page.content = marked(page.content)

  // Encode content so it can be saved as JSON
  page.content = new Buffer(page.content).toString('base64')

  // Clean up the filename
  filename = filename
    .replace(/.*\/content\//, "") // remove basepath
    .replace(/\.md$/, "")  // remove extension

  // Use filename as title if not specified in frontmatter
  // (and remove superfluous npm- prefix)
  if (!page.title)
    page.title = path.basename(filename).replace(/^npm-/, "")

  // Infer section from top directory
  if (filename.match(/\//))
    page.section = filename.split("/")[0]

  page.href = "/" + filename

  content.pages.push(page)

})


emitter.on("end",function(){

  var sections = compact(uniq(pluck(content.pages, 'section'))).sort()

  content.sections = sections.map(function(id) {
    var section = {
      id: id,
      title: id
    }

    // Look for a page named "index" in this section
    var indexPage = _.find(content.pages, function(page) {
      return path.basename(page.href) === "index" && page.section === section.id
    })

    // Inherit title and href from index page
    if (indexPage) {
      section.title = indexPage.title
      section.href = indexPage.href
    }

    return section
  })

  fs.writeFileSync(contentFile, JSON.stringify(content, null, 2))
  console.log("Wrote %s", path.relative(process.cwd(), contentFile))

  var lite = merge({}, content)
  lite.pages = lite.pages.map(function(page){
    delete page.content
    return page
  })

  fs.writeFileSync(liteFile, JSON.stringify(lite, null, 2))
  console.log("Wrote %s", path.relative(process.cwd(), liteFile))


})
