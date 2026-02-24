use strict;
use warnings;
use v5.28;
use utf8;

use Cwd 'abs_path';
use File::Basename;
use DBI;
use DBD::SQLite::Constants qw(:file_open);

use lib dirname(abs_path(__FILE__));
use AssetExtractor qw($db_key extract_asset);

# the meta db is encrypted now so if you want to run this yourself you need to build DBD::SQLite
#
# replace sqlite3.c and sqlite3.h in the DBD::SQLite distribution with the amalgamation files from
# https://github.com/utelle/SQLite3MultipleCiphers/releases

if (!@ARGV) {
	die 'Usage: extract_resource.pl meta <query>';
}

my $meta = shift @ARGV;
my $root = dirname(abs_path($meta));
my $datadir = $root . "/dat";

my $query = shift @ARGV;

my $metadb = DBI->connect("dbi:SQLite:$meta", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$metadb->{RaiseError} = 1;

$metadb->do('PRAGMA cipher = "chacha20";');
$metadb->do("PRAGMA hexkey = \"$db_key\";");

# work around windows quoting issues (just use ^ as a quote instead)
$query =~ s/\^/"/g;

say "SELECT h, e FROM a WHERE n LIKE \"$query\";";

my $select = $metadb->prepare("SELECT h, e FROM a WHERE n LIKE \"$query\";");

my ($hash, $keyint);

$select->execute;
$select->bind_columns(\($hash, $keyint));

while ($select->fetch) {
	extract_asset($datadir, $hash, $keyint);
}
