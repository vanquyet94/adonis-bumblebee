'use strict'

/**
 * adonis-bumblebee
 *
 * (c) Ralph Huwiler <ralph@huwiler.rocks>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const test = require('japa')
const { ioc } = require('@adonisjs/fold')

const Bumblebee = require('../src/Bumblebee')
const TransformerAbstract = require('../src/Bumblebee/TransformerAbstract')

class Book2Transformer extends TransformerAbstract {
  static get availableInclude () {
    return [
      'author',
      'characters',
      'school'
    ]
  }

  transform (book) {
    return {
      title: book.title
    }
  }

  includeAuthor (book) {
    return this.item(book.author, author => ({ name: author.n }))
  }

  includeCharacters (book) {
    return this.collection(book.characters, Book2CharacterTransformer)
  }

  includeSchool (book) {
    return 'Hogwarts'
  }
}

class Book2CharacterTransformer extends TransformerAbstract {
  static get availableInclude () {
    return [
      'actor'
    ]
  }

  transform (character) {
    return {
      name: character.n
    }
  }

  includeActor (character) {
    return this.item(character.actor, actor => ({ name: actor.n }))
  }
}

class CamelCaseTransformer extends TransformerAbstract {
  static get availableInclude () {
    return [
      'authorName'
    ]
  }

  transform (book) {
    return {
      name: book.title
    }
  }

  includeAuthorName (book) {
    return this.item(book.author, author => author.n)
  }
}

class SnakeCaseTransformer extends TransformerAbstract {
  static get availableInclude () {
    return [
      'author_name'
    ]
  }

  transform (book) {
    return {
      name: book.title
    }
  }

  includeAuthorName (book) {
    return this.item(book.author, author => author.n)
  }
}

class SnakeAndCamelTransformer extends TransformerAbstract {
  static get availableInclude () {
    return [
      'camel',
      'snake'
    ]
  }

  transform (book) {
    return {
      title: book.title
    }
  }

  includeCamel (book) {
    return this.item(book, CamelCaseTransformer)
  }

  includeSnake (book) {
    return this.item(book, SnakeCaseTransformer)
  }
}

const data = {
  title: 'Harry Potter and the Deathly Hallows',
  author: {
    n: 'J. K. Rowling'
  },
  characters: [
    {
      n: 'Harry Potter',
      actor: {
        n: 'Daniel Radcliffe'
      }
    },
    {
      n: 'Hermione Granger',
      actor: {
        n: 'Emma Watson'
      }
    }
  ]
}

const expectedTransform = {
  title: 'Harry Potter and the Deathly Hallows',
  author: {
    name: 'J. K. Rowling'
  },
  characters: [
    {
      name: 'Harry Potter',
      actor: {
        name: 'Daniel Radcliffe'
      }
    },
    {
      name: 'Hermione Granger',
      actor: {
        name: 'Emma Watson'
      }
    }
  ]
}

test.group('Includes can be an array or a string', () => {
  test('includes can be defined by relation', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['author', 'characters.actor'])
      .item(data)
      .transformWith(Book2Transformer)
      .toJSON()

    assert.deepEqual(transformed, expectedTransform)

    const transformedFromString = await Bumblebee.create()
      .include('author,characters.actor')
      .item(data)
      .transformWith(Book2Transformer)
      .toJSON()

    assert.deepEqual(transformedFromString, expectedTransform)
  })

  test('when enabled in config, includes are parsed from the request', async (assert) => {
    const Context = ioc.use('Adonis/Src/HttpContext')
    const Config = ioc.use('Adonis/Src/Config')
    const ctx = new Context()

    // enable request parsing in the config
    Config.set('bumblebee.parseRequest', true)

    // set the query string object for testing,
    // this is equivalent to ?include=author,characters.actor
    ctx._qs = { include: 'author,characters.actor' }

    let transformed = await Bumblebee.create()
      .item(data)
      .transformWith(Book2Transformer)
      .withContext(ctx)
      .toJSON()

    assert.deepEqual(transformed, expectedTransform)

    // test that no error occurs if include param is not set
    ctx._qs = {}

    transformed = await Bumblebee.create()
      .item(data)
      .transformWith(Book2Transformer)
      .withContext(ctx)
      .toJSON()

    assert.deepEqual(transformed, { title: 'Harry Potter and the Deathly Hallows' })
  })

  test('an include function can return a object to be merged', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['school'])
      .item(data)
      .transformWith(Book2Transformer)
      .toJSON()

    assert.deepEqual(transformed, {
      title: 'Harry Potter and the Deathly Hallows',
      school: 'Hogwarts'
    })
  })

  test('data should take precedent over an include with the same name', async (assert) => {
    let availableIncludeWasCalled = false

    class CollisionTransformer extends TransformerAbstract {
      static get availableInclude () {
        availableIncludeWasCalled = true
        return [
          'name'
        ]
      }

      transform (book) {
        return {
          name: book.title
        }
      }

      includeName (book) {
        return this.item(book.author, author => ({ name: author.n }))
      }
    }

    const transformed = await Bumblebee.create()
      .include(['name'])
      .item(data)
      .transformWith(CollisionTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      name: 'Harry Potter and the Deathly Hallows'
    })
    assert.ok(availableIncludeWasCalled)
  })

  test('an include name can be camelCase', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['authorName'])
      .item(data)
      .transformWith(CamelCaseTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      name: 'Harry Potter and the Deathly Hallows',
      authorName: 'J. K. Rowling'
    })
  })

  test('a camelCase include can be requested using snake_case', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['author_name'])
      .item(data)
      .transformWith(CamelCaseTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      name: 'Harry Potter and the Deathly Hallows',
      authorName: 'J. K. Rowling'
    })
  })

  test('an include name can be snake_case', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['author_name'])
      .item(data)
      .transformWith(SnakeCaseTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      name: 'Harry Potter and the Deathly Hallows',
      author_name: 'J. K. Rowling'
    })
  })

  test('a snake_case include can be requested using snake_case', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['author_name'])
      .item(data)
      .transformWith(SnakeCaseTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      name: 'Harry Potter and the Deathly Hallows',
      author_name: 'J. K. Rowling'
    })
  })

  test('a snake_case include can not be requested using camelCase', async (assert) => {
    const transformed = await Bumblebee.create()
      .include(['authorName'])
      .item(data)
      .transformWith(SnakeCaseTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      name: 'Harry Potter and the Deathly Hallows'
    })
  })

  test('a nested camelCase include can be requested', async (assert) => {
    let transformed = await Bumblebee.create()
      .include(['camel.authorName'])
      .item(data)
      .transformWith(SnakeAndCamelTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      title: 'Harry Potter and the Deathly Hallows',
      camel: {
        name: 'Harry Potter and the Deathly Hallows',
        authorName: 'J. K. Rowling'
      }
    })

    transformed = await Bumblebee.create()
      .include(['camel.author_name'])
      .item(data)
      .transformWith(SnakeAndCamelTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      title: 'Harry Potter and the Deathly Hallows',
      camel: {
        name: 'Harry Potter and the Deathly Hallows',
        authorName: 'J. K. Rowling'
      }
    })
  })

  test('a nested snake_case include can be requested', async (assert) => {
    let transformed = await Bumblebee.create()
      .include(['snake.author_name'])
      .item(data)
      .transformWith(SnakeAndCamelTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      title: 'Harry Potter and the Deathly Hallows',
      snake: {
        name: 'Harry Potter and the Deathly Hallows',
        author_name: 'J. K. Rowling'
      }
    })

    transformed = await Bumblebee.create()
      .include(['snake.authorName'])
      .item(data)
      .transformWith(SnakeAndCamelTransformer)
      .toJSON()

    assert.deepEqual(transformed, {
      title: 'Harry Potter and the Deathly Hallows',
      snake: {
        name: 'Harry Potter and the Deathly Hallows'
      }
    })
  })
})
